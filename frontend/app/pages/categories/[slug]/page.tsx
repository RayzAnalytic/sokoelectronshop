'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Star, ShoppingCart } from 'lucide-react';
import { products } from '@/data/products';
import { useCart } from '@/lib/store/cart';
import { WishlistButton } from '@/components/wishlistbutton/WishlistButton';

const slugify = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

export default function CategoryPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const [cartAddingId, setCartAddingId] = useState<string | null>(null);

  const addItem = useCart((s) => s.addItem);

  const items = products.filter((p) => slugify(p.category) === slug);

  const categoryName =
    items[0]?.category ??
    slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  const handleAddToCart = async (
    product: (typeof items)[number],
    e: React.MouseEvent<HTMLButtonElement>
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
      stockCount: product.stockQuantity,
      stock: product.stock,
    });

    setCartAddingId(null);
  };

  return (
    <section className="w-full">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900">
            {categoryName}
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {items.length} {items.length === 1 ? 'product' : 'products'}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50 py-16 px-6 text-center rounded-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-xl">
            🔍
          </div>
          <h3 className="mt-3 text-sm font-semibold text-slate-900">
            No {categoryName.toLowerCase()} found
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Slug received: <code>{slug}</code>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {items.map((product) => {
            const isAdding = cartAddingId === product.id;

            return (
              <Link
                key={product.id}
                href={`/pages/products/${product.id}`}
                className="group bg-white border border-slate-200 rounded-sm overflow-hidden hover:border-slate-300 hover:shadow-xs transition-all duration-150 flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-square w-full bg-slate-50 overflow-hidden relative">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Wishlist heart — top right */}
                    <WishlistButton
                      variantId={product.id}
                      productId={product.id}
                      name={product.name}
                      brand={product.brand}
                      image={product.images[0]}
                      unitPrice={product.price}
                      compareAtPrice={product.compareAtPrice ?? undefined}
                      slug={product.id}
                      stockCount={product.stockQuantity}
                      stock={product.stock}
                      size="sm"
                      className="absolute top-2 right-2 z-10"
                    />

                    {/* Stock status — bottom left */}
                    <span
                      className={`absolute bottom-2 left-2 z-10 text-[10px] font-medium px-2 py-0.5 rounded shadow-xs ${product.stock === 'In Stock'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : product.stock === 'Low Stock'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            : 'bg-red-50 text-red-700 border border-red-200/60'
                        }`}
                    >
                      {product.stock}
                    </span>
                  </div>

                  <div className="p-2">
                    <p className="text-[11px] font-medium text-slate-500 uppercase truncate">
                      {product.brand}
                    </p>
                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-slate-950 transition-colors line-clamp-2 mt-0.5 mb-2">
                      {product.name}
                    </h3>

                    <div className="flex items-center gap-1 text-[11px] text-slate-600 mb-2">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="font-medium text-slate-900">
                        {product.rating}
                      </span>
                      <span className="text-slate-400">
                        ({product.reviewCount})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-2 pt-0">
                  <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-bold text-slate-900">
                        ${product.price.toFixed(2)}
                      </span>
                      {product.compareAtPrice && (
                        <span className="text-[10px] text-slate-400 line-through">
                          ${product.compareAtPrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleAddToCart(product, e)}
                      disabled={isAdding || product.stock === 'Out of Stock'}
                      aria-label="Add to cart"
                      className="bg-slate-900 text-white p-2 rounded-sm hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                      {isAdding ? (
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
                      ) : (
                        <ShoppingCart className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}