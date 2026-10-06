'use client';

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Search, MoreVertical, Edit, Copy, ExternalLink, Trash2,
  ChevronDown, X, AlertTriangle, Check, LayoutGrid, List as ListIcon,
  ArrowUpDown, Package, Tag, Layers, Palette, Ruler, DollarSign, Warehouse,
  FileText, Image as ImageIcon, Video, Star, Box, Upload, Loader2,
} from 'lucide-react';
import AddProductModal from '@/components/admin/AddProductModal';
import BulkUploadModal, {
  type ImportedProduct,
} from '@/components/admin/BulkUploadModal';
import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import type {
  AdminBrandRef,
  AdminCategoryRef,
  AdminProduct,
  AdminProductWrite,
} from '@/lib/admin-types';

// --- TYPES ---
type ProductStatus = 'Published' | 'Draft' | 'Archived';
type ViewMode = 'table' | 'cards';
type InventoryStatus = 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Backorder';

interface ProductVariant {
  id: string;
  options: { name: string; value: string }[];
  sku: string;
  price: number;
  stock: number;
  image?: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  shortDescription: string;
  category: string;
  brand: string;
  tags: string[];
  price: number;
  salePrice?: number;
  costPrice?: number;
  tax: number;
  discount: number;
  stock: number;
  lowStockThreshold: number;
  inventoryStatus: InventoryStatus;
  status: ProductStatus;
  image: string;
  video?: string;
  featured: boolean;
  variants: ProductVariant[];
  variantOptions: { name: string; values: string[] }[];
}

const STATUSES: ProductStatus[] = ['Published', 'Draft', 'Archived'];

const formatKES = (n: number) =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(n);

// ═══════════════════════════════════════════════════════════════════════════
// Mapping helpers — the only place the price semantics flip
// ═══════════════════════════════════════════════════════════════════════════
function computeInventoryStatus(
  qty: number,
  threshold: number,
): InventoryStatus {
  if (qty === 0) return 'Out of Stock';
  if (qty <= threshold) return 'Low Stock';
  return 'In Stock';
}

function apiToProduct(p: AdminProduct): Product {
  const priceNum = parseFloat(p.price);
  const compareNum = p.compare_at_price ? parseFloat(p.compare_at_price) : null;

  // Backend: price = selling price, compare_at_price = crossed-out price.
  // Frontend: price = crossed-out price, salePrice = selling price.
  const displayPrice = compareNum ?? priceNum;
  const displaySale = compareNum && compareNum > priceNum ? priceNum : undefined;

  return {
    id: p.id,
    name: p.name,
    sku: p.id, // backend has no SKU — use the product id as a stable label
    description: p.description,
    shortDescription: p.description,
    category: p.category.name,
    brand: p.brand.name,
    tags: [],
    price: displayPrice,
    salePrice: displaySale,
    costPrice: undefined,
    tax: 16,
    discount: displaySale
      ? Math.round(((displayPrice - displaySale) / displayPrice) * 100)
      : 0,
    stock: p.stock_quantity,
    lowStockThreshold: p.low_stock_threshold,
    inventoryStatus: computeInventoryStatus(
      p.stock_quantity,
      p.low_stock_threshold,
    ),
    status: p.is_active ? 'Published' : 'Draft',
    image: p.images[0]?.url || '/placeholder.png',
    featured: p.featured,
    variantOptions: [],
    variants: [],
  };
}

function productToApi(
  p: Partial<Product>,
  brandId: number,
  categoryId: number,
): AdminProductWrite {
  const price = p.salePrice ?? p.price ?? 0;
  const compare = p.salePrice ? (p.price ?? null) : null;

  return {
    name: p.name ?? '',
    description: p.description ?? '',
    brand_id: brandId,
    category_id: categoryId,
    price: String(price),
    compare_at_price: compare !== null ? String(compare) : null,
    stock_quantity: p.stock ?? 0,
    low_stock_threshold: p.lowStockThreshold ?? 5,
    featured: p.featured ?? false,
    best_seller: false,
    sales_volume: '',
    is_active: p.status !== 'Draft' && p.status !== 'Archived',
    images: p.image
      ? [{ url: p.image, is_primary: true, sort_order: 0 }]
      : [],
    features: [],
    specs: {},
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<AdminBrandRef[]>([]);
  const [categories, setCategories] = useState<AdminCategoryRef[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ProductStatus | null>(null);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('featured');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openKebabId, setOpenKebabId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [duplicateProduct, setDuplicateProduct] = useState<Product | null>(null);
  const [variantsProduct, setVariantsProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  const anyModalOpen =
    addOpen || bulkOpen || deleteProductId !== null || editProduct !== null ||
    viewProduct !== null || duplicateProduct !== null || variantsProduct !== null;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  // ── Initial load ──
  const refresh = useCallback(async () => {
    try {
      const [rows, brandList, categoryList] = await Promise.all([
        adminApi.products.list(),
        adminApi.brands.list(),
        adminApi.categories.list(),
      ]);
      setProducts(rows.map(apiToProduct));
      setBrands(brandList);
      setCategories(categoryList);
      setLoadError('');
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.message || 'Could not load products.'
          : 'Could not load products.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Close kebab when clicking elsewhere
  useEffect(() => {
    const onDoc = () => setOpenKebabId(null);
    if (openKebabId) document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [openKebabId]);

  // ── Helpers for save flows ──
  const resolveBrandId = (name: string): number => {
    const hit = brands.find((b) => b.name === name);
    if (hit) return hit.id;
    // Fallback: if the modal sent a name we don't know, use the first brand.
    return brands[0]?.id ?? 0;
  };

  const resolveCategoryId = (name: string): number => {
    const hit = categories.find((c) => c.name === name);
    if (hit) return hit.id;
    return categories[0]?.id ?? 0;
  };

  // ── Filter + sort ──
  const filtered = useMemo(() => {
    return products
      .filter((p) => {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q);
        const matchesCat = !selectedCategory || p.category === selectedCategory;
        const matchesBrand = !selectedBrand || p.brand === selectedBrand;
        const matchesStatus = !selectedStatus || p.status === selectedStatus;
        let matchesStock = true;
        if (selectedStock === 'In stock') matchesStock = p.stock > 10;
        else if (selectedStock === 'Low') matchesStock = p.stock >= 1 && p.stock <= 10;
        else if (selectedStock === 'Out') matchesStock = p.stock === 0;
        return matchesSearch && matchesCat && matchesBrand && matchesStatus && matchesStock;
      })
      .sort((a, b) => {
        if (sortBy === 'price-low') return a.price - b.price;
        if (sortBy === 'price-high') return b.price - a.price;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'stock') return b.stock - a.stock;
        return 0;
      });
  }, [products, searchQuery, selectedCategory, selectedBrand, selectedStatus, selectedStock, sortBy]);

  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length;
  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? [] : filtered.map((p) => p.id));
  const toggleRow = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );

  // ── Delete ──
  const confirmDelete = async () => {
    if (!deleteProductId) return;
    const id = deleteProductId;
    setDeleteProductId(null);

    // Optimistic.
    const previous = products;
    setProducts((prev) => prev.filter((p) => p.id !== id));

    try {
      await adminApi.products.remove(id);
      flash('Product deleted.');
    } catch (err) {
      setProducts(previous);
      flash(
        err instanceof ApiError
          ? err.message || 'Could not delete product.'
          : 'Could not delete product.',
      );
    }
  };

  const confirmBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    const previous = products;
    setProducts((prev) => prev.filter((p) => !ids.includes(p.id)));
    setSelectedIds([]);

    try {
      await Promise.all(ids.map((id) => adminApi.products.remove(id)));
      flash(`Deleted ${ids.length} product${ids.length > 1 ? 's' : ''}.`);
    } catch {
      setProducts(previous);
      flash('Could not delete all products. Refresh and try again.');
    }
  };

  // ── Duplicate ──
  const confirmDuplicate = async () => {
    if (!duplicateProduct) return;
    const source = duplicateProduct;
    setDuplicateProduct(null);
    setSaving(true);

    try {
      const brandId = resolveBrandId(source.brand);
      const categoryId = resolveCategoryId(source.category);
      const payload = productToApi(
        {
          ...source,
          name: `${source.name} (Copy)`,
          status: 'Draft',
        },
        brandId,
        categoryId,
      );

      const created = await adminApi.products.create(payload);
      setProducts((prev) => [apiToProduct(created), ...prev]);
      flash('Product duplicated.');
    } catch (err) {
      flash(
        err instanceof ApiError
          ? err.message || 'Could not duplicate product.'
          : 'Could not duplicate product.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Create (Add Product modal) ──
  const handleCreate = async (data: any) => {
    setSaving(true);
    try {
      const brandId = resolveBrandId(data.brand || '');
      const categoryId = resolveCategoryId(data.category || '');

      const payload = productToApi(
        {
          name: data.name || 'Untitled',
          description: data.description || '',
          shortDescription: data.shortDescription || '',
          category: data.category || '',
          brand: data.brand || '',
          price: Number(data.price) || 0,
          salePrice: data.salePrice ? Number(data.salePrice) : undefined,
          stock: Number(data.stock) || 0,
          lowStockThreshold: Number(data.lowStockThreshold) || 10,
          status: data.status === 'draft' ? 'Draft' : 'Published',
          image: data.images?.[0] || '/placeholder.png',
          featured: !!data.featured,
        },
        brandId,
        categoryId,
      );

      const created = await adminApi.products.create(payload);
      setProducts((prev) => [apiToProduct(created), ...prev]);
      setAddOpen(false);
      flash('Product created.');
    } catch (err) {
      flash(
        err instanceof ApiError
          ? err.message || 'Could not create product.'
          : 'Could not create product.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Update (quick edit) ──
  const handleUpdate = async () => {
    if (!editProduct) return;
    const product = editProduct;
    setSaving(true);

    try {
      const brandId = resolveBrandId(product.brand);
      const categoryId = resolveCategoryId(product.category);
      const payload = productToApi(product, brandId, categoryId);

      const updated = await adminApi.products.update(product.id, payload);
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? apiToProduct(updated) : p)),
      );
      setEditProduct(null);
      flash('Product updated.');
    } catch (err) {
      flash(
        err instanceof ApiError
          ? err.message || 'Could not update product.'
          : 'Could not update product.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Bulk import ──
  const handleBulkImport = async (rows: ImportedProduct[]) => {
    if (rows.length === 0) return;
    setSaving(true);

    try {
      const payloads = rows.map((row) => {
        const stock = Number(row.stock) || 0;
        const price = Number(row.price) || 0;
        const salePrice = row.salePrice ? Number(row.salePrice) : undefined;

        const brandId = resolveBrandId(row.brand || '');
        const categoryId = resolveCategoryId(row.category || '');

        const apiPrice = salePrice ?? price;
        const apiCompare = salePrice ? price : null;

        // Use the row's image when present, fall back to the placeholder
        // otherwise. The modal validates the URL format (must start with
        // https:// or /) before the row is importable.
        const imageUrl = row.image && row.image.trim()
          ? row.image.trim()
          : '/placeholder.png';

        return {
          name: row.name || 'Untitled',
          description: row.shortDescription || '',
          brand_id: brandId,
          category_id: categoryId,
          price: String(apiPrice),
          compare_at_price: apiCompare !== null ? String(apiCompare) : null,
          stock_quantity: stock,
          low_stock_threshold: 10,
          featured: false,
          best_seller: false,
          is_active: row.status !== 'draft',
          images: [{ url: imageUrl, is_primary: true, sort_order: 0 }],
          features: [],
          specs: {},
        } as AdminProductWrite;
      });

      const result = await adminApi.products.bulk(payloads);
      setProducts((prev) => [
        ...result.created.map(apiToProduct),
        ...prev,
      ]);
      setBulkOpen(false);

      const n = result.created.length;
      const failed = result.errors.length;
      flash(
        failed === 0
          ? `Imported ${n} product${n === 1 ? '' : 's'}.`
          : `Imported ${n}; ${failed} failed.`,
      );
    } catch (err) {
      flash(
        err instanceof ApiError
          ? err.message || 'Bulk import failed.'
          : 'Bulk import failed.',
      );
    } finally {
      setSaving(false);
    }
  };

  const activeFilterCount =
    (selectedCategory ? 1 : 0) +
    (selectedBrand ? 1 : 0) +
    (selectedStatus ? 1 : 0) +
    (selectedStock ? 1 : 0);

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedBrand(null);
    setSelectedStatus(null);
    setSelectedStock(null);
    setSortBy('featured');
  };

  const brandNames = brands.map((b) => b.name);
  const categoryNames = categories.map((c) => c.name);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">
      {/* PAGE HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Products</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              {isLoading
                ? 'Loading…'
                : `Manage your product catalog · ${products.length} products`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkOpen(true)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] transition disabled:opacity-60"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bulk upload</span>
              <span className="sm:hidden">Bulk</span>
            </button>

            <div className="inline-flex bg-slate-100 p-0.5 rounded-sm border border-slate-200">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-sm transition ${viewMode === 'table' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                title="Table view"
              >
                <ListIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-sm transition ${viewMode === 'cards' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                title="Card view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setAddOpen(true)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition disabled:opacity-60"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add product</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">
        {/* LOAD ERROR */}
        {loadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm text-[13px] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {loadError}
          </div>
        )}

        {/* FILTER BAR */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search products by name or SKU…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              label="Category"
              value={selectedCategory}
              options={categoryNames}
              onChange={setSelectedCategory}
            />
            <FilterDropdown
              label="Brand"
              value={selectedBrand}
              options={brandNames}
              onChange={setSelectedBrand}
            />
            <FilterDropdown
              label="Status"
              value={selectedStatus}
              options={STATUSES as unknown as string[]}
              onChange={(v) => setSelectedStatus(v as ProductStatus | null)}
            />
            <FilterDropdown
              label="Stock"
              value={selectedStock}
              options={['In stock', 'Low', 'Out']}
              onChange={setSelectedStock}
            />
            <FilterDropdown
              label="Sort"
              icon={<ArrowUpDown className="w-3.5 h-3.5" />}
              value={sortBy === 'featured' ? null : sortBy}
              options={['price-low', 'price-high', 'name', 'stock']}
              labels={{
                'price-low': 'Price: Low to High',
                'price-high': 'Price: High to Low',
                name: 'Name A–Z',
                stock: 'Most stock',
              }}
              onChange={(v) => setSortBy(v ?? 'featured')}
              align="end"
            />
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-[13px] text-red-600 hover:underline font-medium px-2 py-2"
              >
                Clear ({activeFilterCount})
              </button>
            )}
          </div>
        </div>

        {/* BULK ACTIONS */}
        {selectedIds.length > 0 && (
          <div className="bg-blue-950 text-white rounded-sm px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[13px]">
              <span className="bg-blue-900 font-medium px-2 py-0.5 rounded-sm">
                {selectedIds.length} selected
              </span>
              <span className="text-blue-200 hidden sm:inline">Bulk actions</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => flash('Change status: coming soon.')}
                className="bg-blue-900 hover:bg-blue-800 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Change status
              </button>
              <button
                onClick={() => flash('Bulk price update: coming soon.')}
                className="bg-blue-900 hover:bg-blue-800 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Update price
              </button>
              <button
                onClick={() => flash('Export CSV: coming soon.')}
                className="bg-blue-900 hover:bg-blue-800 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Export CSV
              </button>
              <button
                onClick={confirmBulkDelete}
                className="bg-red-600 hover:bg-red-500 px-2.5 py-2 rounded-sm text-[13px] font-medium transition inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        )}

        {/* LOADING */}
        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-sm p-12 text-center text-slate-500 text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
            Loading products…
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                      />
                    </th>
                    <th className="py-2 px-2 font-medium">Image</th>
                    <th className="py-2 px-3 font-medium">Product</th>
                    <th className="py-2 px-3 font-medium">ID</th>
                    <th className="py-2 px-3 font-medium">Category</th>
                    <th className="py-2 px-3 font-medium text-right">Price</th>
                    <th className="py-2 px-3 font-medium text-center">Stock</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-12 text-center text-slate-400 text-[13px]"
                      >
                        {products.length === 0
                          ? 'No products yet. Add one to get started.'
                          : 'No products match your filters.'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => {
                      const stockBadge =
                        p.stock === 0
                          ? 'bg-red-50 text-red-600 border-red-200'
                          : p.stock <= p.lowStockThreshold
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      const statusBadge =
                        p.status === 'Published'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : p.status === 'Draft'
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-amber-50 text-amber-700 border-amber-100';
                      const isKebabOpen = openKebabId === p.id;

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(p.id)}
                              onChange={() => toggleRow(p.id)}
                              className="rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <img
                              src={p.image}
                              alt={p.name}
                              className="w-9 h-9 rounded-sm object-cover border border-slate-200"
                            />
                          </td>
                          <td className="py-2 px-3 max-w-[280px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-slate-900 truncate">
                                {p.name}
                              </span>
                              {p.featured && (
                                <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-slate-500 font-mono">
                            {p.id}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {p.category}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="font-semibold text-slate-900">
                              {formatKES(p.salePrice ?? p.price)}
                            </div>
                            {p.salePrice && (
                              <div className="text-[13px] text-slate-400 line-through">
                                {formatKES(p.price)}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${stockBadge}`}
                            >
                              {p.stock}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${statusBadge}`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenKebabId(isKebabOpen ? null : p.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-900 rounded-sm hover:bg-slate-100 transition"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {isKebabOpen && (
                              <KebabMenu
                                onEdit={() => {
                                  setOpenKebabId(null);
                                  setEditProduct(p);
                                }}
                                onDuplicate={() => {
                                  setOpenKebabId(null);
                                  setDuplicateProduct(p);
                                }}
                                onView={() => {
                                  setOpenKebabId(null);
                                  setViewProduct(p);
                                }}
                                onDelete={() => {
                                  setOpenKebabId(null);
                                  setDeleteProductId(p.id);
                                }}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((p) => {
              const stockBadge =
                p.stock === 0
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : p.stock <= p.lowStockThreshold
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200';
              const isKebabOpen = openKebabId === p.id;

              return (
                <div
                  key={p.id}
                  className="bg-white border border-slate-200 rounded-sm p-2 space-y-2 relative"
                >
                  <div className="relative aspect-[4/3] rounded-sm overflow-hidden bg-slate-100 border border-slate-200">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 right-2 bg-blue-950 text-white font-medium text-[13px] px-2 py-0.5 rounded-sm">
                      {p.status}
                    </span>
                    {p.featured && (
                      <span className="absolute top-2 left-2 bg-amber-500 text-white font-medium text-[13px] px-2 py-0.5 rounded-sm inline-flex items-center gap-1">
                        <Star className="w-3 h-3 fill-white" />
                        Featured
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-blue-950 uppercase tracking-wide truncate">
                        {p.category}
                      </span>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenKebabId(isKebabOpen ? null : p.id);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-900 rounded-sm hover:bg-slate-100 transition"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {isKebabOpen && (
                          <KebabMenu
                            align="right"
                            onEdit={() => {
                              setOpenKebabId(null);
                              setEditProduct(p);
                            }}
                            onDuplicate={() => {
                              setOpenKebabId(null);
                              setDuplicateProduct(p);
                            }}
                            onView={() => {
                              setOpenKebabId(null);
                              setViewProduct(p);
                            }}
                            onDelete={() => {
                              setOpenKebabId(null);
                              setDeleteProductId(p.id);
                            }}
                          />
                        )}
                      </div>
                    </div>

                    <h3 className="text-[13px] font-medium text-slate-900 line-clamp-2">
                      {p.name}
                    </h3>
                    <p className="text-[13px] text-slate-400 font-mono">
                      {p.id}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[13px] font-bold text-slate-900">
                        {formatKES(p.salePrice ?? p.price)}
                      </span>
                      {p.salePrice && (
                        <span className="text-[13px] text-slate-400 line-through ml-1">
                          {formatKES(p.price)}
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-sm font-medium text-[13px] border ${stockBadge}`}
                    >
                      {p.stock} left
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ADD PRODUCT MODAL */}
      <AddProductModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleCreate}
      />

      {/* BULK UPLOAD MODAL */}
      <BulkUploadModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onSave={handleBulkImport}
        brands={brands}
        categories={categories}
      />

      {/* DELETE CONFIRM */}
      {deleteProductId && (
        <Popup onClose={() => setDeleteProductId(null)}>
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-sm bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <h3 className="text-[15px] font-semibold text-slate-900">
              Delete product?
            </h3>
          </div>
          <p className="text-[13px] text-slate-500 mt-2">
            This cannot be undone. The product will be permanently removed.
          </p>
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setDeleteProductId(null)}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-500 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              Delete
            </button>
          </div>
        </Popup>
      )}

      {/* QUICK EDIT */}
      {editProduct && (
        <Popup onClose={() => setEditProduct(null)}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[15px] font-semibold text-slate-900">
              Quick edit
            </h3>
            <button
              onClick={() => setEditProduct(null)}
              className="text-slate-400 hover:text-slate-900 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 text-[13px]">
            <label className="block">
              <span className="block font-medium text-slate-700 mb-1">Name</span>
              <input
                value={editProduct.name}
                onChange={(e) =>
                  setEditProduct({ ...editProduct, name: e.target.value })
                }
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block font-medium text-slate-700 mb-1">
                  List price (KES)
                </span>
                <input
                  type="number"
                  value={editProduct.price}
                  onChange={(e) =>
                    setEditProduct({
                      ...editProduct,
                      price: Number(e.target.value),
                    })
                  }
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </label>
              <label className="block">
                <span className="block font-medium text-slate-700 mb-1">
                  Sale price (KES)
                </span>
                <input
                  type="number"
                  value={editProduct.salePrice ?? ''}
                  onChange={(e) =>
                    setEditProduct({
                      ...editProduct,
                      salePrice: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block font-medium text-slate-700 mb-1">
                  Stock
                </span>
                <input
                  type="number"
                  value={editProduct.stock}
                  onChange={(e) =>
                    setEditProduct({
                      ...editProduct,
                      stock: Number(e.target.value),
                    })
                  }
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </label>
              <label className="block">
                <span className="block font-medium text-slate-700 mb-1">
                  Low-stock threshold
                </span>
                <input
                  type="number"
                  value={editProduct.lowStockThreshold}
                  onChange={(e) =>
                    setEditProduct({
                      ...editProduct,
                      lowStockThreshold: Number(e.target.value),
                    })
                  }
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </label>
            </div>

            <label className="block">
              <span className="block font-medium text-slate-700 mb-1">
                Status
              </span>
              <select
                value={editProduct.status}
                onChange={(e) =>
                  setEditProduct({
                    ...editProduct,
                    status: e.target.value as ProductStatus,
                  })
                }
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setEditProduct(null)}
              disabled={saving}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={saving}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </Popup>
      )}

      {/* VIEW PRODUCT DRAWER */}
      {viewProduct && (
        <ProductDrawer
          product={viewProduct}
          onClose={() => setViewProduct(null)}
        />
      )}

      {/* DUPLICATE */}
      {duplicateProduct && (
        <Popup onClose={() => setDuplicateProduct(null)}>
          <h3 className="text-[15px] font-semibold text-slate-900">
            Duplicate product?
          </h3>
          <p className="text-[13px] text-slate-500 mt-2">
            Create a copy of{' '}
            <span className="font-medium text-slate-900">
              {duplicateProduct.name}
            </span>
            . The copy will be saved as Draft.
          </p>
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setDuplicateProduct(null)}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              Cancel
            </button>
            <button
              onClick={confirmDuplicate}
              disabled={saving}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Duplicating…
                </>
              ) : (
                'Duplicate'
              )}
            </button>
          </div>
        </Popup>
      )}

      {/* Backdrop when any modal is open */}
      {anyModalOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm pointer-events-none" />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[110] bg-slate-900 text-white text-[13px] px-4 py-2.5 rounded-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Product Drawer ─────────────────────────── */
function ProductDrawer({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border-l border-slate-200 w-full max-w-2xl h-full overflow-y-auto shadow-xl flex flex-col"
      >
        <div className="px-3 py-3 border-b border-slate-200 sticky top-0 bg-white z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-9 h-9 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold text-slate-900 truncate">
                Product Details
              </h3>
              <p className="text-[13px] text-slate-500 truncate font-mono">
                {product.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 space-y-3">
          <div className="aspect-[16/9] rounded-sm overflow-hidden bg-slate-100 border border-slate-200">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">
                {product.category}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-[13px] text-slate-500">
                {product.brand}
              </span>
              {product.featured && (
                <span className="text-[13px] font-medium bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-sm inline-flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-700" /> Featured
                </span>
              )}
            </div>
            <h2 className="text-[15px] font-bold text-slate-900">
              {product.name}
            </h2>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
              <DollarSign className="w-3.5 h-3.5" />
              Pricing
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[13px]">
              <Stat label="List price" value={formatKES(product.price)} />
              <Stat
                label="Sale price"
                value={
                  product.salePrice ? formatKES(product.salePrice) : '—'
                }
              />
              <Stat
                label="Discount"
                value={product.discount ? `${product.discount}%` : '—'}
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
              <Warehouse className="w-3.5 h-3.5" />
              Inventory
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[13px]">
              <Stat label="Stock" value={`${product.stock} units`} />
              <Stat
                label="Low-stock threshold"
                value={`${product.lowStockThreshold} units`}
              />
              <Stat
                label="Inventory status"
                value={product.inventoryStatus}
              />
            </div>
          </div>

          {product.description && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
                <FileText className="w-3.5 h-3.5" />
                Description
              </div>
              <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
              <ImageIcon className="w-3.5 h-3.5" />
              Media
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="aspect-square rounded-sm overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src={product.image}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── FilterDropdown ─────────────────────────── */
function FilterDropdown({
  label,
  value,
  options,
  labels,
  onChange,
  icon,
  align = 'start',
}: {
  label: string;
  value: string | null;
  options: string[];
  labels?: Record<string, string>;
  onChange: (v: string | null) => void;
  icon?: React.ReactNode;
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', onDoc);
      document.addEventListener('keydown', onKey);
    }
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const display = value ? labels?.[value] ?? value : label;
  const isActive = value !== null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 border rounded-sm px-3 py-2 text-[13px] font-medium transition whitespace-nowrap ${isActive
          ? 'bg-blue-50 border-blue-950 text-blue-950'
          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
      >
        {icon}
        {display}
        <ChevronDown
          className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className={`absolute top-full mt-1 w-56 rounded-sm border border-slate-200 bg-white shadow-lg z-50 p-1 ${align === 'end' ? 'right-0' : 'left-0'
            }`}
        >
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`w-full text-left px-2 py-2 rounded-sm text-[13px] ${!isActive
              ? 'bg-blue-50 text-blue-950 font-medium'
              : 'text-slate-700 hover:bg-slate-50'
              }`}
          >
            All {label.toLowerCase()}
          </button>
          <div className="border-t border-slate-100 my-1" />
          {options.map((opt) => {
            const isSelected = value === opt;
            return (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-2 py-2 rounded-sm text-[13px] flex items-center justify-between ${isSelected
                  ? 'bg-blue-50 text-blue-950 font-medium'
                  : 'text-slate-700 hover:bg-slate-50'
                  }`}
              >
                <span>{labels?.[opt] ?? opt}</span>
                {isSelected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Kebab menu ─────────────────────────── */
function KebabMenu({
  onEdit,
  onDuplicate,
  onView,
  onDelete,
  align = 'right',
}: {
  onEdit: () => void;
  onDuplicate: () => void;
  onView: () => void;
  onDelete: () => void;
  align?: 'left' | 'right';
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`absolute top-full mt-1 w-44 bg-white border border-slate-200 rounded-sm shadow-lg z-50 py-1 ${align === 'right' ? 'right-0' : 'left-0'
        }`}
    >
      <MenuItem
        icon={<Edit className="w-3.5 h-3.5" />}
        label="Edit"
        onClick={onEdit}
      />
      <MenuItem
        icon={<Copy className="w-3.5 h-3.5" />}
        label="Duplicate"
        onClick={onDuplicate}
      />
      <MenuItem
        icon={<ExternalLink className="w-3.5 h-3.5" />}
        label="View"
        onClick={onView}
      />
      <div className="border-t border-slate-100 my-1" />
      <MenuItem
        icon={<Trash2 className="w-3.5 h-3.5" />}
        label="Delete"
        onClick={onDelete}
        danger
      />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left transition ${danger
        ? 'text-red-600 hover:bg-red-50'
        : 'text-slate-700 hover:bg-slate-50'
        }`}
    >
      <span className={danger ? 'text-red-500' : 'text-slate-400'}>
        {icon}
      </span>
      {label}
    </button>
  );
}

/* ─────────────────────────── Popup wrapper ─────────────────────────── */
function Popup({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl"
      >
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────────── Stat ─────────────────────────── */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm p-2">
      <p className="text-[13px] font-medium text-slate-500">{label}</p>
      <p className="text-[13px] font-semibold text-slate-900 mt-0.5">
        {value}
      </p>
    </div>
  );
}