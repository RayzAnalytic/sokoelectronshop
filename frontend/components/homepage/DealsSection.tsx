'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Clock } from 'lucide-react';
import { useCart } from '@/lib/store/cart';
import {
  catalogApi,
  type CatalogDealCard,
  type SpecialDealsQuery,
} from '@/lib/api';

const toNum = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
};

const formatKES = (n: number) => `KES ${n.toLocaleString('en-KE')}`;

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
  if (ms <= 0) return 'bg-slate-50 text-slate-500 border-slate-200';
  const hours = ms / 3_600_000;
  if (hours < 6) return 'bg-blue-950/10 text-blue-950 border-blue-950/40';
  if (hours < 24) return 'bg-slate-100 text-slate-700 border-slate-300';
  return 'bg-slate-50 text-slate-500 border-slate-200';
}

type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

const stockStatusFor = (deal: CatalogDealCard): StockStatus => {
  if (!deal.inStock || deal.stockCount <= 0) return 'Out of Stock';
  if (deal.stockCount < 5) return 'Low Stock';
  return 'In Stock';
};

const STOCK_BADGE_STYLES: Record<StockStatus, string> = {
  'In Stock': 'bg-blue-950 text-white',
  'Low Stock': 'bg-blue-900 text-white',
  'Out of Stock': 'bg-slate-400 text-white',
};

const DEALS_LIMIT = 4;

export default function DealsSection() {
  const [deals, setDeals] = useState<CatalogDealCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cartAddingId, setCartAddingId] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  const addItem = useCart((s) => s.addItem);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    const query: SpecialDealsQuery = {
      sort_by: 'Featured Deals',
    };

    catalogApi.specialDeals
      .list(query, ctrl.signal)
      .then((cards) => {
        if (ctrl.signal.aborted) return;
        setDeals(cards.slice(0, DEALS_LIMIT));
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setDeals([]);
        setError('Could not load current deals.');
      })
      .finally(() => {
        if (ctrl.signal.aborted) return;
        setLoading(false);
        setHasLoadedOnce(true);
      });

    return () => ctrl.abort();
  }, []);

  const activeDeals = useMemo(() => {
    if (now === null) return deals;
    return deals.filter((deal) => {
      if (!deal.endDate) return true;
      return new Date(deal.endDate).getTime() > now;
    });
  }, [deals, now]);

  const handleAddToCart = useCallback(
    async (deal: CatalogDealCard, e: React.MouseEvent): Promise<void> => {
      e.preventDefault();
      e.stopPropagation();
      if (!deal.inStock) return;

      setCartAddingId(deal.id);
      try {
        await addItem({
          variantId: deal.productId,
          productId: deal.productId,
          name: deal.name,
          brand: deal.brand,
          image: deal.image || '',
          unitPrice: toNum(deal.price),
          compareAtPrice: toNum(deal.originalPrice),
          slug: deal.productId,
          stockCount: deal.stockCount,
          stock: stockStatusFor(deal),
        });
      } finally {
        setCartAddingId(null);
      }
    },
    [addItem],
  );

  return (
    <section className="bg-white py-4 xs:py-5 sm:py-6 lg:py-6 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-5 lg:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-2 xs:mb-2 gap-1.5 sm:gap-0">
          <div className="min-w-0">
            <h2 className="text-base xs:text-lg sm:text-xl md:text-2xl font-bold text-slate-900">
              Special <span className="text-blue-950">Deals</span> &amp; Discounts
            </h2>
            <p className="text-[11px] xs:text-[12px] sm:text-[13px] text-slate-500 mt-1 ">
              Save big on premium electronics with verified price drops and
              special offers.
            </p>
          </div>
          <Link
            href="/pages/products/specialdeals"
            className="text-[11px] xs:text-[12px] sm:text-[13px] font-medium text-slate-900 hover:text-blue-950 hover:underline mt-2 sm:mt-0 inline-flex items-center shrink-0 self-start sm:self-auto transition-colors"
          >
            View all deals →
          </Link>
        </div>

        {loading && activeDeals.length === 0 && (
          <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-2">
            {Array.from({ length: DEALS_LIMIT }).map((_, i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded overflow-hidden animate-pulse"
              >
                <div className="aspect-square bg-slate-100" />
                <div className="p-2 space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                  <div className="h-4 bg-slate-100 rounded w-3/4" />
                  <div className="h-7 bg-slate-100 rounded mt-2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && hasLoadedOnce && (error || activeDeals.length === 0) && (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded p-6 xs:p-8 text-center">
            <Clock className="w-7 h-7 xs:w-8 xs:h-8 text-blue-950 mx-auto mb-1" />
            <p className="text-[12px] xs:text-[13px] sm:text-sm font-medium text-slate-900">
              {error ?? 'No active deals right now'}
            </p>
            <p className="text-[11px] xs:text-[12px] text-slate-500 mt-1">
              Check back soon for new promotions.
            </p>
          </div>
        )}

        {!loading && !error && activeDeals.length > 0 && (
          <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-2">
            {activeDeals.map((deal) => {
              const isAdding = cartAddingId === deal.id;
              const price = toNum(deal.price);
              const previousPrice = toNum(deal.originalPrice);
              const stockStatus = stockStatusFor(deal);
              const discountPct = deal.discountPct;

              const remainingMs =
                now !== null && deal.endDate
                  ? new Date(deal.endDate).getTime() - now
                  : null;
              const remainingLabel =
                remainingMs !== null ? formatRemaining(remainingMs) : null;

              return (
                <Link
                  key={deal.id}
                  href={`/pages/products/specialdeals?open=${deal.productId}`}
                  className="group bg-white border border-slate-200 rounded overflow-hidden hover:border-blue-950 hover:shadow-lg transition-all duration-150 flex flex-col justify-between"
                >
                  <div>
                    <div className="aspect-square w-full bg-slate-50 overflow-hidden relative">
                      {deal.image ? (
                        <img
                          src={deal.image}
                          alt={deal.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200">
                          <ShoppingCart className="w-7 h-7 xs:w-8 xs:h-8 text-slate-400" />
                        </div>
                      )}

                      <div className="absolute top-0 left-0 w-20 h-20 xs:w-24 xs:h-24 overflow-hidden pointer-events-none z-10">
                        <div className="absolute transform -rotate-45 bg-blue-950 text-white font-bold text-[11px] xs:text-[11px] sm:text-[12px] py-1 left-[-42px] top-[14px] xs:top-[20px] w-[150px] text-center shadow-sm">
                          {discountPct}% OFF
                        </div>
                      </div>

                      <span
                        className={`absolute top-1 xs:top-2 right-1 xs:right-2 text-[11px] xs:text-[10px] sm:text-[12px] font-semibold px-1 xs:px-1.5 sm:px-2 py-0.5 rounded shadow-sm ${STOCK_BADGE_STYLES[stockStatus]}`}
                      >
                        {stockStatus}
                      </span>
                    </div>

                    <div className="p-1.5 xs:p-2">
                      <p className="text-[11px] xs:text-[11px] sm:text-[12px] font-medium text-slate-500 uppercase truncate">
                        {deal.brand}
                      </p>

                      <h3 className="text-[11px] xs:text-[12px] font-semibold text-slate-900 group-hover:text-blue-950 transition-colors line-clamp-2 mt-0.5 mb-1.5 xs:mb-2">
                        {deal.name}
                      </h3>

                      {remainingLabel && remainingMs !== null && (
                        <div
                          className={`flex items-center space-x-1 text-[9px] xs:text-[10px] sm:text-[11px] font-medium border rounded p-1 mb-1 ${urgencyClass(
                            remainingMs,
                          )}`}
                        >
                          <Clock className="w-2.5 h-2.5 xs:w-3 xs:h-3 shrink-0" />
                          <span className="truncate">{remainingLabel}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-1.5 xs:p-2 pt-0">
                    <div className="pt-1.5 xs:pt-2 border-t border-slate-200 mt-1">
                      <div className="flex items-baseline flex-wrap gap-1 xs:gap-1.5 mb-1.5 xs:mb-2 min-w-0">
                        <span className="text-[11px] xs:text-[12px] sm:text-sm font-bold text-slate-900 whitespace-nowrap">
                          {formatKES(price)}
                        </span>
                        <span className="text-[10px] xs:text-[11px] sm:text-[12px] text-slate-500 line-through whitespace-nowrap">
                          {formatKES(previousPrice)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleAddToCart(deal, e)}
                        disabled={isAdding || stockStatus === 'Out of Stock'}
                        className="w-full bg-blue-950 hover:bg-blue-900 text-white font-bold py-3 px-1.5 xs:px-2 rounded text-[12px] xs:text-[13px] sm:text-[13px] transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1"
                      >
                        {isAdding ? (
                          <>
                            <svg
                              className="animate-spin h-3 w-3 xs:h-3.5 xs:w-3.5 text-white shrink-0"
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
                            <span className="truncate">Adding...</span>
                          </>
                        ) : stockStatus === 'Out of Stock' ? (
                          <span className="truncate">Sold Out</span>
                        ) : (
                          <>
                            <ShoppingCart className="w-3 h-3 xs:w-3.5 xs:h-3.5 shrink-0" />
                            <span className="truncate">Add to Cart</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}