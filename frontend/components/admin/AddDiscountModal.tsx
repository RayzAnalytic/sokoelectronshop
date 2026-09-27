// components/admin/AddDiscountModal.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Percent,
  DollarSign,
  Truck,
  Gift,
  Check,
  AlertCircle,
  ChevronDown,
  Eye,
  Zap,
  Flame,
  Search,
  CheckSquare,
  Square,
  Calendar,
  Tag,
  Users,
  Target,
  Image as ImageIcon,
  Layers,
  PackagePlus,
  Plus,
} from 'lucide-react';
import AddProductForDiscountModal from './AddProductForDiscountModal';
import { useProducts } from '@/lib/store/products';
import type {
  Discount,
  DiscountPayload,
  DiscountType,
  PromotionType,
  AppliesTo,
} from '@/lib/store/discounts';

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

const TYPE_ICONS: Record<string, any> = {
  Percentage: Percent,
  'Fixed Amount': DollarSign,
  'Free Shipping': Truck,
  'Buy X Get Y': Gift,
};

const toLocalInput = (s: string) => {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromLocalInput = (s: string) => s.replace('T', ' ');

const EMPTY: DiscountPayload = {
  code: '',
  description: '',
  type: 'Percentage',
  value: '',
  minOrder: 0,
  maxCap: 0,
  usageLimit: 100,
  perCustomer: 1,
  startDate: '',
  endDate: '',
  status: 'Scheduled',
  appliesTo: 'All Products',
  eligibility: 'All Customers',
  targetAudience: 'All People & Customers',
  isMostDeal: false,
  image: '',

  displayOnDealsPage: true,
  promotionType: 'Percentage Discount',
  dealTitle: '',
  badgeText: '',
  priority: 0,
  linkedProductIds: [],
  linkedCategories: [],
};

interface Props {
  open: boolean;
  initial: Discount | null;
  onClose: () => void;
  onSave: (payload: DiscountPayload) => void;
}

export default function AddDiscountModal({
  open,
  initial,
  onClose,
  onSave,
}: Props) {
  const allCatalogueProducts = useProducts((s) => s.getAll());

  const [form, setForm] = useState<DiscountPayload>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [productSearch, setProductSearch] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productPickerTab, setProductPickerTab] = useState<
    'catalogue' | 'new'
  >('catalogue');
  const [addProductOpen, setAddProductOpen] = useState(false);

  // Load incoming values into the form when the modal opens
  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              ...EMPTY,
              ...initial,
              startDate: toLocalInput(initial.startDate),
              endDate: toLocalInput(initial.endDate),
            }
          : { ...EMPTY }
      );
      setErrors({});
      setProductSearch('');
      setShowProductPicker(false);
      setProductPickerTab('catalogue');
    }
  }, [open, initial]);

  // ESC + scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !addProductOpen) onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, addProductOpen]);

  const setField = <K extends keyof DiscountPayload>(
    key: K,
    value: DiscountPayload[K]
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) {
      setErrors((e) => {
        const n = { ...e };
        delete n[key as string];
        return n;
      });
    }
  };

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const source = allCatalogueProducts;
    if (!q) return source;
    return source.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [productSearch, allCatalogueProducts]);

  const toggleProduct = (id: string) => {
    setForm((f) => {
      const has = f.linkedProductIds.includes(id);
      return {
        ...f,
        linkedProductIds: has
          ? f.linkedProductIds.filter((x) => x !== id)
          : [...f.linkedProductIds, id],
      };
    });
    if (errors.linkedProductIds) {
      setErrors((e) => {
        const n = { ...e };
        delete n.linkedProductIds;
        return n;
      });
    }
  };

  const toggleCategory = (cat: string) => {
    setForm((f) => {
      const has = f.linkedCategories.includes(cat);
      return {
        ...f,
        linkedCategories: has
          ? f.linkedCategories.filter((x) => x !== cat)
          : [...f.linkedCategories, cat],
      };
    });
    if (errors.linkedCategories) {
      setErrors((e) => {
        const n = { ...e };
        delete n.linkedCategories;
        return n;
      });
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.code.trim()) e.code = 'Code is required';
    if (!/^[A-Z0-9_-]+$/.test(form.code.trim()))
      e.code = 'A-Z, 0-9, _ and - only';
    if (!form.description.trim())
      e.description = 'Description is required';
    if (!form.value.trim()) e.value = 'Value is required';
    if (!form.startDate) e.startDate = 'Start date is required';
    if (!form.endDate) e.endDate = 'End date is required';
    if (
      form.startDate &&
      form.endDate &&
      form.endDate <= form.startDate
    )
      e.endDate = 'End must be after start';
    if (
      form.appliesTo === 'Specific Products' &&
      form.linkedProductIds.length === 0
    )
      e.linkedProductIds = 'Select at least one product';
    if (
      form.appliesTo === 'Specific Categories' &&
      form.linkedCategories.length === 0
    )
      e.linkedCategories = 'Select at least one category';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSave({
      ...form,
      code: form.code.trim().toUpperCase(),
      startDate: fromLocalInput(form.startDate),
      endDate: fromLocalInput(form.endDate),
      id: initial?.id,
    });
    onClose();
  };

  if (!open) return null;

  const TypeIcon = TYPE_ICONS[form.type] ?? Percent;

  const previewProducts =
    form.appliesTo === 'Specific Products'
      ? allCatalogueProducts
          .filter((p: { id: string; }) => form.linkedProductIds.includes(p.id))
          .slice(0, 3)
      : form.appliesTo === 'Specific Categories'
      ? allCatalogueProducts
          .filter((p: { category: string; }) => form.linkedCategories.includes(p.category))
          .slice(0, 3)
      : allCatalogueProducts.slice(0, 3);

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-sm shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <header className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">
              {initial ? 'Edit discount' : 'Create discount'}
            </h2>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Configure the coupon and how it appears on the storefront
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* BODY */}
        <div className="overflow-y-auto p-3 space-y-4">
          {/* 1. BASICS */}
          <Section icon={<Tag className="w-3.5 h-3.5" />} title="Basics">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Code"
                value={form.code}
                onChange={(v) => setField('code', v.toUpperCase())}
                placeholder="SOKOWEEKEND15"
                error={errors.code}
                mono
              />
              <Field
                label="Display image URL"
                value={form.image}
                onChange={(v) => setField('image', v)}
                placeholder="https://…"
                icon={<ImageIcon className="w-3.5 h-3.5" />}
              />
            </div>
            <Field
              label="Description"
              value={form.description}
              onChange={(v) => setField('description', v)}
              placeholder="Short summary shown on the card"
              error={errors.description}
            />
          </Section>

          {/* 2. MECHANICS */}
          <Section
            icon={<TypeIcon className="w-3.5 h-3.5" />}
            title="Discount mechanics"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onChange={(v) => setField('type', v as DiscountType)}
                  options={[
                    'Percentage',
                    'Fixed Amount',
                    'Free Shipping',
                    'Buy X Get Y',
                  ]}
                />
              </div>
              <Field
                label="Value"
                value={form.value}
                onChange={(v) => setField('value', v)}
                placeholder={
                  form.type === 'Percentage' ? '15%' : 'KES 500'
                }
                error={errors.value}
                mono
              />
              <Field
                label="Minimum order (KES)"
                value={String(form.minOrder)}
                onChange={(v) => setField('minOrder', Number(v) || 0)}
                type="number"
                mono
              />
              <Field
                label="Max cap (KES, 0 = none)"
                value={String(form.maxCap)}
                onChange={(v) => setField('maxCap', Number(v) || 0)}
                type="number"
                mono
              />
            </div>
          </Section>

          {/* 3. LIMITS */}
          <Section icon={<Users className="w-3.5 h-3.5" />} title="Limits">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Total usage limit"
                value={String(form.usageLimit)}
                onChange={(v) => setField('usageLimit', Number(v) || 0)}
                type="number"
                mono
              />
              <Field
                label="Per customer"
                value={String(form.perCustomer)}
                onChange={(v) => setField('perCustomer', Number(v) || 0)}
                type="number"
                mono
              />
            </div>
          </Section>

          {/* 4. SCHEDULE */}
          <Section
            icon={<Calendar className="w-3.5 h-3.5" />}
            title="Schedule"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Start date & time"
                value={form.startDate}
                onChange={(v) => setField('startDate', v)}
                type="datetime-local"
                error={errors.startDate}
              />
              <Field
                label="End date & time"
                value={form.endDate}
                onChange={(v) => setField('endDate', v)}
                type="datetime-local"
                error={errors.endDate}
              />
            </div>
            <p className="text-[13px] text-slate-500 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
              Deals disappear from the storefront the moment this end time
              passes.
            </p>
          </Section>

          {/* 5. TARGETING */}
          <Section icon={<Target className="w-3.5 h-3.5" />} title="Targeting">
            <div>
              <Label>Applies to</Label>
              <Select
                value={form.appliesTo}
                onChange={(v) => setField('appliesTo', v as AppliesTo)}
                options={[
                  'All Products',
                  'Specific Products',
                  'Specific Categories',
                ]}
              />
            </div>

            {/* Specific Categories */}
            {form.appliesTo === 'Specific Categories' && (
              <div>
                <Label>Categories</Label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => {
                    const on = form.linkedCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm text-[13px] font-medium border transition ${
                          on
                            ? 'bg-blue-950 text-white border-blue-950'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {on ? (
                          <CheckSquare className="w-3 h-3" />
                        ) : (
                          <Square className="w-3 h-3" />
                        )}
                        {cat}
                      </button>
                    );
                  })}
                </div>
                {errors.linkedCategories && (
                  <p className="text-[13px] text-red-600 mt-1">
                    {errors.linkedCategories}
                  </p>
                )}
              </div>
            )}

            {/* Specific Products */}
            {form.appliesTo === 'Specific Products' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Products</Label>
                  <button
                    type="button"
                    onClick={() => setShowProductPicker((s) => !s)}
                    className="text-[13px] font-medium text-blue-950 hover:underline"
                  >
                    {showProductPicker ? 'Close picker' : 'Pick products'}
                  </button>
                </div>

                {/* Selected chips */}
                {form.linkedProductIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.linkedProductIds.map((id) => {
                      const p = allCatalogueProducts.find(
                        (x) => x.id === id
                      );
                      if (!p) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-[13px] px-2 py-0.5 rounded-sm"
                        >
                          <span className="truncate max-w-[180px]">
                            {p.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleProduct(id)}
                            className="text-slate-400 hover:text-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {showProductPicker && (
                  <div className="border border-slate-200 rounded-sm overflow-hidden bg-white">
                    {/* Tabs */}
                    <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 border-b border-slate-200">
                      <button
                        type="button"
                        onClick={() => setProductPickerTab('catalogue')}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm text-[13px] font-medium transition ${
                          productPickerTab === 'catalogue'
                            ? 'bg-white text-blue-950 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Browse catalogue
                        <span className="ml-1 px-1.5 py-0.5 rounded-sm text-[11px] bg-slate-200 text-slate-700">
                          {allCatalogueProducts.length}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductPickerTab('new')}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm text-[13px] font-medium transition ${
                          productPickerTab === 'new'
                            ? 'bg-white text-blue-950 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <PackagePlus className="w-3.5 h-3.5" />
                        Add new product
                      </button>
                    </div>

                    {/* Tab: catalogue */}
                    {productPickerTab === 'catalogue' && (
                      <>
                        <div className="relative border-b border-slate-100">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            value={productSearch}
                            onChange={(e) =>
                              setProductSearch(e.target.value)
                            }
                            placeholder="Search by name, brand, or category…"
                            className="w-full pl-8 pr-3 py-2 text-[13px] focus:outline-none"
                          />
                        </div>
                        <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                          {filteredProducts.length === 0 ? (
                            <li className="p-3 text-center text-[13px] text-slate-400">
                              No products match.{' '}
                              <button
                                type="button"
                                onClick={() => setProductPickerTab('new')}
                                className="text-blue-950 font-medium hover:underline"
                              >
                                Add a new one?
                              </button>
                            </li>
                          ) : (
                            filteredProducts.map((p) => {
                              const id = String(p.id);
                              const on = form.linkedProductIds.includes(id);
                              return (
                                <li key={id}>
                                  <button
                                    type="button"
                                    onClick={() => toggleProduct(id)}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition ${
                                      on
                                        ? 'bg-blue-50'
                                        : 'hover:bg-slate-50'
                                    }`}
                                  >
                                    {on ? (
                                      <CheckSquare className="w-4 h-4 text-blue-950 shrink-0" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                                    )}
                                    <img
                                      src={p.images[0]}
                                      alt=""
                                      className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[13px] font-medium text-slate-900 truncate">
                                        {p.name}
                                      </p>
                                      <p className="text-[13px] text-slate-500">
                                        {p.brand} · KES{' '}
                                        {p.price.toLocaleString()}
                                      </p>
                                    </div>
                                  </button>
                                </li>
                              );
                            })
                          )}
                        </ul>
                      </>
                    )}

                    {/* Tab: add new */}
                    {productPickerTab === 'new' && (
                      <div className="p-4 text-center">
                        <PackagePlus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-[13px] font-medium text-slate-900">
                          Create a brand-new product
                        </p>
                        <p className="text-[13px] text-slate-500 mt-1 mb-3">
                          It&apos;s added to the catalogue and selected here
                          automatically.
                        </p>
                        <button
                          type="button"
                          onClick={() => setAddProductOpen(true)}
                          className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Open product builder
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {errors.linkedProductIds && (
                  <p className="text-[13px] text-red-600">
                    {errors.linkedProductIds}
                  </p>
                )}
              </div>
            )}
          </Section>

          {/* 6. ELIGIBILITY */}
          <Section icon={<Users className="w-3.5 h-3.5" />} title="Eligibility">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Who can use it</Label>
                <Select
                  value={form.eligibility}
                  onChange={(v) => setField('eligibility', v)}
                  options={[
                    'All Customers',
                    'First-time Buyers',
                    'Returning Customers',
                    'VIP Segment',
                  ]}
                />
              </div>
              <div>
                <Label>Target audience</Label>
                <Select
                  value={form.targetAudience}
                  onChange={(v) => setField('targetAudience', v)}
                  options={[
                    'All People & Customers',
                    'Newsletter Subscribers',
                    'WhatsApp Opt-ins',
                  ]}
                />
              </div>
            </div>
          </Section>

          {/* 7. STOREFRONT */}
          <Section
            icon={<Eye className="w-3.5 h-3.5" />}
            title="Storefront display"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Promotion type (Deals page)</Label>
                <Select
                  value={form.promotionType}
                  onChange={(v) =>
                    setField('promotionType', v as PromotionType)
                  }
                  options={[
                    'Percentage Discount',
                    'Fixed Amount Discount',
                    'Sale Price',
                    'Campaign',
                  ]}
                />
              </div>
              <Field
                label="Badge text override"
                value={form.badgeText}
                onChange={(v) => setField('badgeText', v.toUpperCase())}
                placeholder="15% OFF"
                mono
              />
              <Field
                label="Deal title (marketing)"
                value={form.dealTitle}
                onChange={(v) => setField('dealTitle', v)}
                placeholder="Weekend Flash Sale"
              />
              <Field
                label="Priority (higher shows first)"
                value={String(form.priority)}
                onChange={(v) => setField('priority', Number(v) || 0)}
                type="number"
                mono
              />
            </div>

            <div className="space-y-2 pt-1 border-t border-slate-100">
              <ToggleRow
                icon={<Eye className="w-3.5 h-3.5" />}
                label="Show on Deals page"
                desc="Renders these products on /pages/products/specialdeals"
                value={form.displayOnDealsPage}
                onChange={(v) => setField('displayOnDealsPage', v)}
              />
              <ToggleRow
                icon={<Flame className="w-3.5 h-3.5" />}
                label="Mark as Top Deal"
                desc="Pins to the customer catalog and WhatsApp broadcasts"
                value={form.isMostDeal}
                onChange={(v) => setField('isMostDeal', v)}
              />
            </div>
          </Section>

          {/* 8. PREVIEW */}
          <Section icon={<Zap className="w-3.5 h-3.5" />} title="Preview">
            {!form.displayOnDealsPage ? (
              <p className="text-[13px] text-slate-500 italic">
                Not shown on the Deals page — nothing to preview.
              </p>
            ) : previewProducts.length === 0 ? (
              <p className="text-[13px] text-slate-500 italic">
                Select products or categories to see a preview.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {previewProducts.map((p: { id: React.Key | null | undefined; images: (string | Blob | undefined)[]; brand: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; name: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; }) => (
                  <div
                    key={p.id}
                    className="bg-white border border-slate-200 rounded-sm overflow-hidden"
                  >
                    <div className="aspect-square bg-slate-100 relative">
                      <img
                        src={p.images[0]}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-0 left-0 px-2 py-0.5 text-[10px] font-bold text-white bg-blue-950 rounded-br-sm">
                        {form.badgeText || form.value}
                      </span>
                    </div>
                    <div className="p-2">
                      <p className="text-[10px] uppercase text-slate-500 truncate">
                        {p.brand}
                      </p>
                      <p className="text-[12px] font-semibold text-slate-900 truncate">
                        {p.name}
                      </p>
                      <p className="text-[11px] text-slate-600 mt-1">
                        Ends{' '}
                        {form.endDate
                          ? new Date(form.endDate).toLocaleDateString()
                          : '—'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
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
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            <Check className="w-3.5 h-3.5" />
            {initial ? 'Save changes' : 'Create discount'}
          </button>
        </footer>
      </div>

      {/* Nested product builder */}
      <AddProductForDiscountModal
        open={addProductOpen}
        onClose={() => setAddProductOpen(false)}
        onCreated={(created) => {
          setForm((f) => ({
            ...f,
            linkedProductIds: f.linkedProductIds.includes(created.id)
              ? f.linkedProductIds
              : [...f.linkedProductIds, created.id],
          }));
          setProductPickerTab('catalogue');
        }}
      />
    </div>
  );
}

/* ══════════ Sub-components ══════════ */

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-slate-200 rounded-sm">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50">
        <span className="w-6 h-6 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
          {icon}
        </span>
        <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
      </header>
      <div className="p-3 space-y-3">{children}</div>
    </section>
  );
}

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
  icon,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <div className="relative">
        {icon && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-white border rounded-sm py-2 text-[13px] focus:outline-none focus:ring-1 ${
            icon ? 'pl-8 pr-3' : 'px-3'
          } ${
            error
              ? 'border-red-400 focus:ring-red-500'
              : 'border-slate-200 focus:ring-blue-950'
          } ${mono ? 'font-mono' : ''}`}
        />
      </div>
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

function ToggleRow({
  icon,
  label,
  desc,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex items-start gap-2">
        <span className="w-6 h-6 rounded-sm bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-slate-900">{label}</p>
          <p className="text-[13px] text-slate-500 mt-0.5">{desc}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-5 w-9 rounded-full transition-colors shrink-0 ${
          value ? 'bg-blue-950' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}