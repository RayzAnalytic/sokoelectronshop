// components/WishlistButton.tsx
'use client';

import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { useWishlist } from '@/lib/store/wishlist';
import { useAuth } from '@/lib/hooks/use-auth';

interface Props {
  variantId: string;
  productId: string;
  name: string;
  brand?: string;
  image: string;
  unitPrice: number;
  compareAtPrice?: number | null;
  slug: string;
  /** Catalog snapshot at the moment of saving. All optional — a caller
   *  without them just produces a wishlist row with sensible defaults. */
  stock?: 'In Stock' | 'Low Stock' | 'Out of Stock';
  stockCount?: number;
  discountPercent?: number;
  rating?: number;
  reviewCount?: number;
  className?: string;
  size?: 'sm' | 'md';
}

export function WishlistButton({
  size = 'md',
  className = '',
  variantId,
  productId,
  name,
  brand,
  image,
  unitPrice,
  compareAtPrice,
  slug,
  stock,
  stockCount,
  discountPercent,
  rating,
  reviewCount,
}: Props) {
  // Auth state — cached across the app, one request total.
  const { me } = useAuth();
  const isSignedIn = me !== null;

  // Reactive to the store — flipping any wishlist row anywhere
  // updates every mounted button instantly.
  const isWishlisted = useWishlist((s) => s.has(variantId));
  const toggle = useWishlist((s) => s.toggle);

  // Local pending state — disables the button while the request is
  // in flight. The store itself updates optimistically, so the icon
  // flips immediately; this just prevents a rapid double-click.
  const [busy, setBusy] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    setBusy(true);
    try {
      await toggle(
        {
          // camelCase props → snake_case entry
          variant_id: variantId,
          product_id: productId,
          product_name: name,
          product_brand: brand,
          product_image: image,
          product_slug: slug,
          unit_price: unitPrice,
          compare_at_price: compareAtPrice ?? null,
          // Catalog snapshot — omitted fields fall back to
          // model defaults on the backend.
          stock,
          stock_count: stockCount,
          discount_percent: discountPercent,
          rating,
          review_count: reviewCount,
        },
        isSignedIn,
      );
    } catch {
      // Store already rolled back the optimistic update. No toast
      // here — a failing toggle is not loud enough to warrant one,
      // and the icon returning to its previous state is the signal.
    } finally {
      setBusy(false);
    }
  };

  const sizes = {
    sm: { btn: 'h-7 w-7', icon: 'h-3.5 w-3.5' },
    md: { btn: 'h-8 w-8', icon: 'h-4 w-4' },
  }[size];

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label={
        isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'
      }
      aria-pressed={isWishlisted}
      title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      className={`${sizes.btn} rounded-full flex items-center justify-center transition-all duration-150 disabled:opacity-60 disabled:cursor-wait ${isWishlisted
        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
        : 'bg-white/90 backdrop-blur-sm text-slate-500 hover:text-rose-600 hover:bg-white shadow-sm border border-slate-200'
        } ${className}`}
    >
      <Heart
        className={`${sizes.icon} transition-all ${isWishlisted ? 'fill-current' : ''
          }`}
      />
    </button>
  );
}