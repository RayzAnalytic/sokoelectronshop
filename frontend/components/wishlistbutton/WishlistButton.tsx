// components/WishlistButton.tsx
'use client';

import React from 'react';
import { Heart } from 'lucide-react';
import { useWishlist } from '@/lib/store/wishlist';

interface Props {
  variantId: string;
  productId: string;
  name: string;
  brand?: string;
  image: string;
  unitPrice: number;
  compareAtPrice?: number;
  slug: string;
  stockCount?: number;
  stock?: string;
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
  stockCount,
  stock,
}: Props) {
  const isWishlisted = useWishlist((s) => s.isWishlisted(variantId));
  const toggleItem = useWishlist((s) => s.toggleItem);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    toggleItem({
      variantId,
      productId,
      name,
      brand,
      image,
      unitPrice,
      compareAtPrice,
      slug,
      stockCount,
      stock,
    });
  };

  const sizes = {
    sm: { btn: 'h-7 w-7', icon: 'h-3.5 w-3.5' },
    md: { btn: 'h-8 w-8', icon: 'h-4 w-4' },
  }[size];

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      aria-pressed={isWishlisted}
      title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      className={`${sizes.btn} rounded-full flex items-center justify-center transition-all duration-150 ${
        isWishlisted
          ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
          : 'bg-white/90 backdrop-blur-sm text-slate-500 hover:text-rose-600 hover:bg-white shadow-sm border border-slate-200'
      } ${className}`}
    >
      <Heart
        className={`${sizes.icon} transition-all ${
          isWishlisted ? 'fill-current' : ''
        }`}
      />
    </button>
  );
}