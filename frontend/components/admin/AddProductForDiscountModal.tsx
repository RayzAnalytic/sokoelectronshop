// components/admin/AddProductForDiscountModal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Check,
  AlertCircle,
  Image as ImageIcon,
  Plus,
  Trash2,
  ChevronDown,
  PackagePlus,
} from 'lucide-react';
import { useProducts, type Product } from '@/lib/store/products';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Fired after the product is created and stored. */
  onCreated: (product: Product) => void;
}

const CATEGORIES = [
  'Phones',
  'Laptops',
  'Tablets',
  'TVs',
  'Audio',
  'Accessories',
  'Gaming',
  'Smartwatches',
];

type Draft = {
  name: string;
  brand: string;
  category: string;
  price: string;
  compareAtPrice: string;
  stock: Product['stock'];
  stockQuantity: string;
  description: string;
  images: string[];
  rating: string;
  reviewCount: string;
  featured: boolean;
};

const EMPTY: Draft = {
  name: '',
  brand: '',
  category: 'Phones',
  price: '',
  compareAtPrice: '',
  stock: 'In Stock',
  stockQuantity: '10',
  description: '',
  images: [''],
  rating: '4.5',
  reviewCount: '0',
  featured: false,
};

export default function AddProductForDiscountModal({
  open,
  onClose,
  onCreated,
}: Props) {
  const addProduct = useProducts((s: { addProduct: any; }) => s.addProduct);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset every time the modal opens
  useEffect(() => {
    if (open) {
      setDraft(EMPTY);
      setErrors({});
    }
  }, [open]);

  // ESC to close + freeze body scroll
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (errors[key as string]) {
      setErrors((e) => {
        const n = { ...e };
        delete n[key as string];
        return n;
      });
    }
  };

  const updateImage = (idx: number, value: string) => {
    setDraft((d) => {
      const next = [...d.images];
      next[idx] = value;
      return { ...d, images: next };
    });
  };

  const addImageField = () =>
    setDraft((d) => ({ ...d, images: [...d.images, ''] }));

  const removeImageField = (idx: number) =>
    setDraft((d) => ({
      ...d,
      images:
        d.images.length === 1 ? [''] : d.images.filter((_, i) => i !== idx),
    }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!draft.name.trim()) e.name = 'Product name is required';
    if (!draft.brand.trim()) e.brand = 'Brand is required';
    if (!draft.price.trim() || Number(draft.price) <= 0)
      e.price = 'Enter a valid price';
    if (
      draft.compareAtPrice &&
      Number(draft.compareAtPrice) <= Number(draft.price)
    )
      e.compareAtPrice = 'Compare-at price must be higher than price';
    if (!draft.images.some((i) => i.trim()))
      e.images = 'At least one image is required';
    if (Number(draft.stockQuantity) < 0)
      e.stockQuantity = 'Cannot be negative';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const cleanImages = draft.images.map((i) => i.trim()).filter(Boolean);

    const created = addProduct({
      name: draft.name.trim(),
      brand: draft.brand.trim(),
      category: draft.category,
      price: Number(draft.price),
      compareAtPrice: draft.compareAtPrice
        ? Number(draft.compareAtPrice)
        : null,
      stock: draft.stock,
      stockQuantity: Number(draft.stockQuantity),
      description:
        draft.description.trim() || `${draft.brand} ${draft.name}`,
      images: cleanImages,
      rating: Number(draft.rating) || 0,
      reviewCount: Number(draft.reviewCount) || 0,
      featured: draft.featured,
    });

    onCreated(created);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-sm shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <header className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
              <PackagePlus className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">
                Add new product
              </h2>
              <p className="text-[13px] text-slate-500 mt-0.5">
                It will be added to the catalogue and linked to this discount.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* BODY */}
        <div className="overflow-y-auto p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Product name"
              value={draft.name}
              onChange={(v) => set('name', v)}
              placeholder="e.g. Apex Ultra X1 Pro"
              error={errors.name}
            />
            <Field
              label="Brand"
              value={draft.brand}
              onChange={(v) => set('brand', v)}
              placeholder="e.g. Apex"
              error={errors.brand}
            />
            <div>
              <Label>Category</Label>
              <Select
                value={draft.category}
                onChange={(v) => set('category', v)}
                options={CATEGORIES}
              />
            </div>
            <div>
              <Label>Stock status</Label>
              <Select
                value={draft.stock}
                onChange={(v) => set('stock', v as Product['stock'])}
                options={['In Stock', 'Low Stock', 'Out of Stock']}
              />
            </div>
            <Field
              label="Price (KES)"
              value={draft.price}
              onChange={(v) => set('price', v)}
              placeholder="49999"
              type="number"
              error={errors.price}
              mono
            />
            <Field
              label="Compare-at price (optional)"
              value={draft.compareAtPrice}
              onChange={(v) => set('compareAtPrice', v)}
              placeholder="59999"
              type="number"
              error={errors.compareAtPrice}
              mono
            />
            <Field
              label="Stock quantity"
              value={draft.stockQuantity}
              onChange={(v) => set('stockQuantity', v)}
              type="number"
              error={errors.stockQuantity}
              mono
            />
            <Field
              label="Rating (0–5)"
              value={draft.rating}
              onChange={(v) => set('rating', v)}
              type="number"
              mono
            />
            <Field
              label="Review count"
              value={draft.reviewCount}
              onChange={(v) => set('reviewCount', v)}
              type="number"
              mono
            />
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.featured}
                  onChange={(e) => set('featured', e.target.checked)}
                  className="h-4 w-4 rounded-sm border-slate-300 text-blue-950 focus:ring-blue-950"
                />
                <span className="text-[13px] text-slate-700">
                  Mark as featured
                </span>
              </label>
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <textarea
              rows={3}
              value={draft.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Short summary of the product"
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>

          {/* IMAGES */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Images (URL)</Label>
              <button
                type="button"
                onClick={addImageField}
                className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add another
              </button>
            </div>

            <div className="space-y-2">
              {draft.images.map((img, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-sm bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                    {img.trim() ? (
                      <img
                        src={img}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </span>
                  <input
                    type="text"
                    value={img}
                    onChange={(e) => updateImage(idx, e.target.value)}
                    placeholder="https://… or /product.jpeg"
                    className="flex-1 bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                  {draft.images.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeImageField(idx)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-sm"
                      aria-label="Remove image field"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {errors.images && (
              <p className="text-[13px] text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.images}
              </p>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <footer className="flex items-center justify-end gap-2 px-3 py-2 border-t border-slate-200 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            <Check className="w-3.5 h-3.5" />
            Create &amp; select
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ─── Small sub-components ─── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
      {children}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-white border rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 ${
          error
            ? 'border-red-400 focus:ring-red-500'
            : 'border-slate-200 focus:ring-blue-950'
        } ${mono ? 'font-mono' : ''}`}
      />
      {error && <p className="text-[13px] text-red-600 mt-1">{error}</p>}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-slate-200 rounded-sm py-2 pl-3 pr-8 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 appearance-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
    </div>
  );
}