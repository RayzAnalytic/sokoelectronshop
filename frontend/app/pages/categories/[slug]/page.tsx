'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Star, ShoppingCart, AlertCircle } from 'lucide-react';
import { useCart } from '@/lib/store/cart';
import { WishlistButton } from '@/components/wishlistbutton/WishlistButton';
import {
  catalogApi,
  type CatalogProduct,
  type CatalogCategory,
  type CategoryPageQuery,
} from '@/lib/api';

const toNum = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
};

function formatKES(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type StockKind = 'in' | 'low' | 'out' | 'unknown';

function normalizeStock(raw: string | undefined): StockKind {
  const s = (raw || '').toLowerCase().replace(/[_\s-]/g, '');
  if (s === 'instock' || s === 'in') return 'in';
  if (s === 'lowstock' || s === 'low') return 'low';
  if (s === 'outofstock' || s === 'out' || s === 'soldout') return 'out';
  return 'unknown';
}

function stockBadgeClasses(status: string): string {
  const key = (status || '').toLowerCase().replace(/[_\s-]/g, '');
  if (key === 'instock') return 'bg-green-600 text-white';
  if (key === 'lowstock') return 'bg-orange-500 text-white';
  if (key === 'outofstock') return 'bg-red-600 text-white';
  return 'bg-slate-600 text-white';
}

export default function CategoryPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params?.slug ?? '';

  const [category, setCategory] = useState<CatalogCategory | null>(null);
  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cartAddingId, setCartAddingId] = useState<string | null>(null);

  const addItem = useCart((s) => s.addItem);

  const q = searchParams.get('q') ?? undefined;
  const stockRaw = searchParams.get('stock');
  const sortRaw = searchParams.get('sort');

  const stock =
    stockRaw === 'all' || stockRaw === 'in-stock' || stockRaw === 'low-stock'
      ? (stockRaw as CategoryPageQuery['stock'])
      : undefined;

  const sort =
    sortRaw === 'featured' ||
      sortRaw === 'price-low' ||
      sortRaw === 'price-high' ||
      sortRaw === 'newest' ||
      sortRaw === 'rating'
      ? (sortRaw as CategoryPageQuery['sort'])
      : undefined;

  useEffect(() => {
    if (!slug) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    catalogApi.categories
      .detail(slug, { q, stock, sort }, ctrl.signal)
      .then(({ category: cat, products }) => {
        if (ctrl.signal.aborted) return;
        setCategory(cat);
        setItems(products);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setCategory(null);
        setItems([]);
        setError('Category not found.');
      })
      .finally(() => {
        if (ctrl.signal.aborted) return;
        setLoading(false);
        setHasLoadedOnce(true);
      });

    return () => ctrl.abort();
  }, [slug, q, stock, sort]);

  const handleAddToCart = useCallback(
    async (product: CatalogProduct, e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (normalizeStock(product.stock) === 'out') return;

      setCartAddingId(product.id);
      try {
        await addItem({
          variantId: product.id,
          productId: product.id,
          name: product.name,
          brand: product.brand,
          image: product.images[0] ?? '',
          unitPrice: toNum(product.price),
          compareAtPrice:
            product.compareAtPrice !== null
              ? toNum(product.compareAtPrice)
              : undefined,
          slug: product.slug,
          stockCount: product.stockQuantity,
          stock: product.stock,
        });
      } finally {
        setCartAddingId(null);
      }
    },
    [addItem],
  );

  const fallbackName = slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const categoryName = category?.name ?? fallbackName;
  const itemCount = items.length;

  return (
    <section className="w-full">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h1 className="text-base font-semibold text-slate-900">
            {categoryName}
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {loading
              ? 'Loading…'
              : `${itemCount} ${itemCount === 1 ? 'product' : 'products'}`}
          </p>
        </div>
      </div>

      {error && !loading && (
        <div className="flex flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50 py-16 px-6 text-center rounded">
          <AlertCircle className="w-8 h-8 text-blue-950 mb-2" />
          <h3 className="text-sm font-semibold text-slate-900">{error}</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Slug received: <code>{slug}</code>
          </p>
        </div>
      )}

      {loading && items.length === 0 && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded overflow-hidden animate-pulse"
            >
              <div className="aspect-square bg-slate-100" />
              <div className="p-2 space-y-2">
                <div className="h-3 bg-slate-100 rounded w-1/3" />
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && hasLoadedOnce && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50 py-16 px-6 text-center rounded">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-950/15 text-xl">
            🔍
          </div>
          <h3 className="mt-2 text-sm font-semibold text-slate-900">
            No {categoryName.toLowerCase()} found
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Slug received: <code>{slug}</code>
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {items.map((product) => {
            const isAdding = cartAddingId === product.id;
            const price = toNum(product.price);
            const comparePrice =
              product.compareAtPrice !== null
                ? toNum(product.compareAtPrice)
                : null;
            const isOutOfStock = normalizeStock(product.stock) === 'out';

            return (
              <Link
                key={product.id}
                href={`/pages/products?open=${product.id}`}
                className="group bg-white border border-slate-200 rounded overflow-hidden hover:border-blue-950 hover:shadow-lg transition-all duration-150 flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-square w-full bg-slate-50 overflow-hidden relative">
                    <img
                      src={product.images[0] ?? '/placeholder.jpeg'}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    <WishlistButton
                      variantId={product.id}
                      productId={product.id}
                      name={product.name}
                      brand={product.brand}
                      image={product.images[0] ?? ''}
                      unitPrice={price}
                      compareAtPrice={comparePrice ?? undefined}
                      slug={product.slug}
                      stockCount={product.stockQuantity}
                      stock={product.stock}
                      size="sm"
                      className="absolute top-2 right-2 z-10"
                    />

                    <span
                      className={`absolute bottom-2 left-2 z-10 text-[10px] font-semibold px-2 py-0.5 rounded ${stockBadgeClasses(product.stock)}`}
                    >
                      {product.stock}
                    </span>
                  </div>

                  <div className="p-2">
                    <p className="text-[11px] font-medium text-slate-600 uppercase truncate">
                      {product.brand}
                    </p>
                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-950 transition-colors line-clamp-2 mt-0.5 mb-1">
                      {product.name}
                    </h3>

                    <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-1">
                      <Star className="w-3 h-3 fill-blue-950 text-blue-950" />
                      <span className="font-medium text-slate-900">
                        {toNum(product.rating).toFixed(1)}
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
                      <span className="text-sm font-bold text-blue-950">
                        {formatKES(price)}
                      </span>
                      {comparePrice !== null && (
                        <span className="text-[10px] text-slate-400 line-through">
                          {formatKES(comparePrice)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleAddToCart(product, e)}
                      disabled={isAdding || isOutOfStock}
                      aria-label="Add to cart"
                      className="bg-blue-950 text-white p-2 rounded hover:bg-blue-900 transition-colors disabled:opacity-50"
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