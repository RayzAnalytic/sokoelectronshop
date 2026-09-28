// app/onboarding/steps/step5/page.tsx
'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Plus,
  X,
  Upload,
  Image as ImageIcon,
  FileSpreadsheet,
  Download,
  Loader2,
} from 'lucide-react';

const MAX_IMAGES = 3;

type ProductImageEntry = { url: string; file: File | null };

type Product = {
  id: string;
  name: string;
  category: string;
  price: string;
  salePrice: string;
  stock: string;
  sku: string;
  shortDescription: string;
  images: ProductImageEntry[];
};

type Tab = 'manual' | 'upload';

const CATEGORIES = [
  'Smartphones',
  'Laptops',
  'Audio',
  'Accessories',
  'TVs',
  'Gaming',
];

const EMPTY_FORM = {
  name: '',
  category: CATEGORIES[0],
  price: '',
  salePrice: '',
  stock: '',
  sku: '',
  shortDescription: '',
  images: [] as ProductImageEntry[],
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Step5ProductPage() {
  const [tab, setTab] = useState<Tab>('manual');
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // CSV
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows] = useState<Product[]>([]);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ─── Images ─────────────────────────────────────────────── */

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_IMAGES - form.images.length;
    const incoming = Array.from(files).slice(0, remaining);
    const entries: ProductImageEntry[] = incoming.map((f) => ({
      url: URL.createObjectURL(f),
      file: f,
    }));
    setForm({ ...form, images: [...form.images, ...entries] });
  };

  const removeImage = (idx: number) => {
    const entry = form.images[idx];
    if (entry?.url?.startsWith('blob:')) URL.revokeObjectURL(entry.url);
    setForm({ ...form, images: form.images.filter((_, i) => i !== idx) });
  };

  /* ─── CSV ────────────────────────────────────────────────── */

  const downloadTemplate = () => {
    const csv = [
      'name,category,price,sale_price,stock,sku,short_description',
      'Apex Ultra X1 Pro,Smartphones,89900,99900,10,APX-X1,Flagship 5G smartphone with 6.8 inch OLED',
      'Zenith StudioBook 16,Laptops,149900,169900,4,ZEN-SB16,Creator laptop with RTX graphics',
      'SonicWave ANC Headphones,Audio,24900,29900,15,SNC-ANC,Active noise canceling over-ear headphones',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): Product[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return [];
    const dataRows = lines.slice(1);

    return dataRows
      .map((line, i) => {
        const cells =
          line
            .match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
            ?.map((c) => c.replace(/^"|"$/g, '').trim()) ?? [];
        const [
          name = '',
          category = '',
          price = '',
          salePrice = '',
          stock = '',
          sku = '',
          shortDescription = '',
        ] = cells;

        return {
          id: `csv_${i}_${uid()}`,
          name,
          category: category || CATEGORIES[0],
          price,
          salePrice,
          stock,
          sku,
          shortDescription,
          images: [],
        };
      })
      .filter((p) => p.name && p.price);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('CSV must be 5MB or smaller.');
      return;
    }
    setError(null);
    setParsing(true);
    setFileName(file.name);
    try {
      const text = await file.text();
      setTimeout(() => {
        setCsvRows(parseCSV(text));
        setParsing(false);
      }, 250);
    } catch {
      setError('Could not read the file.');
      setParsing(false);
    }
  };

  const clearCsv = () => {
    setCsvRows([]);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  /* ─── Render ─────────────────────────────────────────────── */

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <header className="text-center max-w-lg mx-auto space-y-2 pt-4">
        <span className="w-12 h-12 rounded-full bg-blue-50 text-blue-950 border border-blue-100 flex items-center justify-center mx-auto">
          <CreditCard className="h-6 w-6" />
        </span>
        <h2 className="text-[18px] font-semibold text-slate-900">
          Add your first product
        </h2>
        <p className="text-[13px] text-slate-500">
          Add one product, or upload your full catalog from a CSV file.
        </p>
      </header>

      {/* Tabs */}
      <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-sm p-1 flex gap-1">
        {(
          [
            { value: 'manual', label: 'Add one product', icon: Plus },
            {
              value: 'upload',
              label: 'Bulk upload (CSV)',
              icon: FileSpreadsheet,
            },
          ] as const
        ).map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-sm text-[12px] font-medium transition ${
              tab === value
                ? 'bg-blue-950 text-white'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ─── Manual tab ─── */}
      {tab === 'manual' && (
        <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-4 space-y-3">
          <Field
            label="Product name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            placeholder="e.g. Apex Ultra X1 Pro"
          />

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-slate-700">
              Category
            </label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value })
              }
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Price (KES)"
              value={form.price}
              onChange={(v) => setForm({ ...form, price: v })}
              placeholder="89900"
            />
            <Field
              label="Sale price (optional)"
              value={form.salePrice}
              onChange={(v) => setForm({ ...form, salePrice: v })}
              placeholder="99900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Stock quantity"
              value={form.stock}
              onChange={(v) => setForm({ ...form, stock: v })}
              placeholder="10"
            />
            <Field
              label="SKU (optional)"
              value={form.sku}
              onChange={(v) => setForm({ ...form, sku: v })}
              placeholder="auto-generated"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-slate-700">
              Short description{' '}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              maxLength={160}
              value={form.shortDescription}
              onChange={(e) =>
                setForm({ ...form, shortDescription: e.target.value })
              }
              placeholder="Flagship 5G smartphone with 6.8 inch OLED…"
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
            />
            <p className="text-[10px] text-slate-400 text-right">
              {form.shortDescription.length}/160
            </p>
          </div>

          {/* Images */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <label className="text-[12px] font-medium text-slate-700">
                Product images
              </label>
              <span className="text-[10px] text-slate-400">
                {form.images.length} of {MAX_IMAGES}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {form.images.map((img, idx) => (
                <div
                  key={idx}
                  className="relative aspect-square rounded-sm overflow-hidden border border-slate-200 bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={`Image ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {idx === 0 && (
                    <span className="absolute bottom-1 left-1 text-[9px] font-semibold bg-blue-950 text-white px-1.5 py-0.5 rounded-sm">
                      Primary
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-white/90 flex items-center justify-center"
                    aria-label="Remove image"
                  >
                    <X className="h-3 w-3 text-rose-600" />
                  </button>
                </div>
              ))}

              {Array.from({
                length: MAX_IMAGES - form.images.length,
              }).map((_, idx) => (
                <label
                  key={`slot-${idx}`}
                  className="aspect-square rounded-sm border border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:bg-white transition"
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => addImages(e.target.files)}
                  />
                  <ImageIcon className="h-5 w-5 text-slate-400" />
                  <span className="text-[10px] text-slate-500 mt-1">
                    {idx === 0 && form.images.length === 0
                      ? 'Add image'
                      : 'Add'}
                  </span>
                </label>
              ))}
            </div>

            <p className="text-[10px] text-slate-500">
              Up to 3 images. First image is used as the primary thumbnail.
            </p>
          </div>
        </div>
      )}

      {/* ─── Upload tab ─── */}
      {tab === 'upload' && (
        <div className="max-w-lg mx-auto space-y-3">
          <div className="bg-blue-50 border border-blue-100 rounded-sm p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-blue-950">
                Start with our CSV template
              </p>
              <p className="text-[10px] text-blue-800 mt-0.5 font-mono truncate">
                name, category, price, sale_price, stock, sku, short_description
              </p>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 bg-white border border-blue-200 hover:bg-blue-50 text-blue-950 font-medium px-3 py-2 rounded-sm text-[12px] shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Download template
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-4">
            <label
              className={`block border-2 border-dashed rounded-sm p-6 text-center cursor-pointer transition ${
                fileName
                  ? 'border-emerald-200 bg-emerald-50/30'
                  : 'border-slate-300 hover:border-blue-950/40 hover:bg-blue-50/20'
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files?.[0]);
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {fileName ? (
                <>
                  <FileSpreadsheet className="h-7 w-7 mx-auto text-emerald-600" />
                  <p className="text-[13px] font-semibold text-slate-900 mt-2">
                    {fileName}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {csvRows.length} products found
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-7 w-7 mx-auto text-slate-400" />
                  <p className="text-[13px] font-semibold text-slate-900 mt-2">
                    Upload a CSV file
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Drag and drop or click to browse · max 5MB
                  </p>
                </>
              )}
            </label>

            {parsing && (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-sm border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Parsing CSV…
              </div>
            )}

            {error && (
              <p className="mt-3 text-[11px] text-rose-600">{error}</p>
            )}

            {csvRows.length > 0 && (
              <div className="mt-3 bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px] font-semibold text-slate-900">
                    {csvRows.length} products ready to import
                  </p>
                  <button
                    type="button"
                    onClick={clearCsv}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-700"
                  >
                    Clear
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {csvRows.slice(0, 6).map((p) => (
                    <div
                      key={p.id}
                      className="border border-slate-200 rounded-sm px-3 py-2"
                    >
                      <p className="text-[12px] font-medium text-slate-900 truncate">
                        {p.name}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {p.category} • {p.stock} in stock • KES {p.price}
                      </p>
                    </div>
                  ))}
                </div>

                {csvRows.length > 6 && (
                  <p className="text-[10px] text-slate-500">
                    Showing the first 6 products. Import will include all{' '}
                    {csvRows.length} rows.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <div className="max-w-lg mx-auto flex items-center gap-2 pt-2">
        <Link
          href="/onboarding/steps/step4"
          className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium px-4 py-2.5 rounded-sm text-[13px] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        <Link
          href="/onboarding/steps/step6"
          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2.5 rounded-sm text-[13px] transition"
        >
          Continue
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

/* ---------- Field ---------- */
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-[12px] font-medium text-slate-700">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
      />
    </label>
  );
}