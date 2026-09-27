'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ShoppingCart, Clock } from 'lucide-react';
import { products as allProducts, type ProductFull } from '@/data/products';
import {
  discounts,
  computeStatus,
  discountedPrice,
  discountPercent,
} from '@/data/discounts';
import { useCart } from '@/lib/store/cart';

// ─────────────────────────────────────────────────────────────
// Deal card — one discount applied to one product
// ─────────────────────────────────────────────────────────────
interface Deal {
  id: string;
  productId: string;
  discountCode: string;
  brand: string;
  name: string;
  /** Final price after the discount is applied */
  price: number;
  /** The product's base price, shown as strikethrough */
  previousPrice: number;
  /** % saved — matches the badge */
  discountPct: number;
  stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock';
  stockCount: number;
  image: string;
  category: string;
  href: string;
  promoEndDate: string | null;
  slug: string;
}

// ─────────────────────────────────────────────────────────────
// Join discounts × products → deal cards, dedupe, top 6
// Runs at module load — pure, no React, safe for SSR
// ─────────────────────────────────────────────────────────────
function buildDealCards(): Deal[] {
  const cards: Deal[] = [];

  for (const discount of discounts) {
    // Skip discounts that aren't marked for the storefront
    if (!discount.displayOnDealsPage) continue;

    // Skip expired ones (scheduled ones are kept; the timer just shows them counting down to start)
    const status = computeStatus(discount.startDate, discount.endDate);
    if (status === 'Expired') continue;

    // Which products does this discount apply to?
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
      const dealPrice = discountedPrice(discount, product.price);

      // Skip if the discount doesn't actually reduce the price
      if (dealPrice >= product.price) continue;

      cards.push({
        id: `${discount.id}__${product.id}`,
        productId: product.id,
        discountCode: discount.code,
        brand: product.brand,
        name: product.name,
        price: dealPrice,
        previousPrice: product.price,
        discountPct: discountPercent(discount, product.price),
        stockStatus: product.stock,
        stockCount: product.stockQuantity,
        image: product.images[0],
        category: product.category,
        // Every card leads to the deals page
        href: '/pages/products/specialdeals',
        promoEndDate: discount.endDate,
        slug: product.id,
      });
    }
  }

  // Highest discount first, one card per product, top 6
  const sorted = cards.sort((a, b) => b.discountPct - a.discountPct);
  const seen = new Set<string>();
  const unique: Deal[] = [];
  for (const card of sorted) {
    if (seen.has(card.productId)) continue;
    seen.add(card.productId);
    unique.push(card);
    if (unique.length >= 6) break;
  }
  return unique;
}

const dealsData = buildDealCards();

const formatKES = (n: number) => `KES ${n.toLocaleString()}`;

/**
 * Human-readable time remaining.
 *   "2 days remaining"
 *   "3hrs remaining"
 *   "45 mins remaining"
 *   "Less than a minute"
 */
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

// Urgency colors — hotter as the deal approaches expiry
function urgencyClass(ms: number): string {
  if (ms <= 0) return 'bg-slate-100 text-slate-500 border-slate-200';
  const hours = ms / 3_600_000;
  if (hours < 6) return 'bg-red-50 text-red-700 border-red-200';
  if (hours < 24) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

export default function DealsSection() {
  const [cartAddingId, setCartAddingId] = useState<string | null>(null);

  // null until mounted — prevents SSR/client mismatch from Date.now()
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Filter out deals whose promo window has closed
  const activeDeals = useMemo(() => {
    if (now === null) return dealsData;
    return dealsData.filter((deal) => {
      if (!deal.promoEndDate) return true;
      return new Date(deal.promoEndDate).getTime() > now;
    });
  }, [now]);

  // Cart store
  const addItem = useCart((s) => s.addItem);

  const handleAddToCart = async (
    deal: Deal,
    e: React.MouseEvent
  ): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();
    setCartAddingId(deal.id);

    await addItem({
      variantId: deal.productId,
      productId: deal.productId,
      name: deal.name,
      brand: deal.brand,
      image: deal.image,
      unitPrice: deal.price,
      compareAtPrice: deal.previousPrice,
      slug: deal.slug,
      stockCount: deal.stockCount,
      stock: deal.stockStatus,
    });

    setCartAddingId(null);
  };

  return (
    <section className="bg-white py-6 lg:py-8 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-4 lg:px-4">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Special Deals &amp; Discounts
            </h2>
            <p className="text-[13px] text-slate-600 mt-1">
              Save big on premium electronics with verified price drops and
              special offers.
            </p>
          </div>
          <Link
            href="/pages/products/specialdeals"
            className="text-[13px] font-medium text-blue-950 hover:underline mt-2 sm:mt-0 inline-flex items-center"
          >
            View all deals →
          </Link>
        </div>

        {/* Empty state */}
        {activeDeals.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-sm p-8 text-center">
            <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-900">
              No active deals right now
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Check back soon for new promotions.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {activeDeals.map((deal) => {
              const isAdding = cartAddingId === deal.id;

              // Timing only after mount
              const remainingMs =
                now !== null && deal.promoEndDate
                  ? new Date(deal.promoEndDate).getTime() - now
                  : null;
              const remainingLabel =
                remainingMs !== null ? formatRemaining(remainingMs) : null;

              return (
                <Link
                  key={deal.id}
                  href={deal.href}
                  className="group bg-white border border-slate-200 rounded-sm overflow-hidden hover:border-blue-200 hover:shadow-sm transition-all duration-150 flex flex-col justify-between"
                >
                  <div>
                    {/* Product Image */}
                    <div className="aspect-square w-full bg-slate-100 overflow-hidden relative">
                      <img
                        src={deal.image}
                        alt={deal.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* 45° Gradient Ribbon — shows the real % off */}
                      <div className="absolute top-0 left-0 w-24 h-24 overflow-hidden pointer-events-none z-10">
                        <div className="absolute transform -rotate-45 bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 text-white font-bold text-[11px] tracking-widest py-1 left-[-42px] top-[20px] w-[150px] text-center shadow-xs">
                          {deal.discountPct}% OFF
                        </div>
                      </div>

                      {/* Stock Status Badge */}
                      <span
                        className={`absolute top-2 right-2 text-[10px] font-medium px-2 py-0.5 rounded shadow-xs ${
                          deal.stockStatus === 'In Stock'
                            ? 'bg-emerald-100 text-emerald-800'
                            : deal.stockStatus === 'Low Stock'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {deal.stockStatus}
                      </span>
                    </div>

                    {/* Card Content */}
                    <div className="p-2">
                      <p className="text-[11px] font-medium text-slate-500 uppercase truncate">
                        {deal.brand}
                      </p>

                      <h3 className="text-[12px] font-semibold text-slate-900 group-hover:text-blue-950 transition-colors line-clamp-2 mt-0.5 mb-2">
                        {deal.name}
                      </h3>

                      {/* Live countdown */}
                      {remainingLabel && remainingMs !== null && (
                        <div
                          className={`flex items-center space-x-1 text-[11px] font-medium border rounded p-1 mb-1 ${urgencyClass(
                            remainingMs
                          )}`}
                        >
                          <Clock className="w-3 h-3 shrink-0" />
                          <span className="truncate">{remainingLabel}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pricing & Add to Cart */}
                  <div className="p-2 pt-0">
                    <div className="pt-2 border-t border-slate-100 mt-1">
                      <div className="flex items-baseline flex-wrap gap-1.5 mb-2.5">
                        <span className="text-sm font-bold text-red-600">
                          {formatKES(deal.price)}
                        </span>
                        <span className="text-[11px] text-slate-400 line-through">
                          {formatKES(deal.previousPrice)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleAddToCart(deal, e)}
                        disabled={
                          isAdding || deal.stockStatus === 'Out of Stock'
                        }
                        className="w-full bg-blue-950 hover:bg-blue-900 text-white font-medium py-1.5 px-2 rounded text-[12px] transition duration-150 ease-in-out disabled:opacity-50 flex items-center justify-center space-x-1"
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
                            <span>Adding...</span>
                          </>
                        ) : deal.stockStatus === 'Out of Stock' ? (
                          <span>Sold Out</span>
                        ) : (
                          <>
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>Add to Cart</span>
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