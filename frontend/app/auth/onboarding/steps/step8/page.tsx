// app/auth/onboarding/steps/step8/page.tsx

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Package,
    Plus,
    X,
    Upload,
    FileSpreadsheet,
    Download,
    Check,
    Trash2,
    Image as ImageIcon,
    Loader2,
} from 'lucide-react';

import { onboarding, ApiError } from '@/lib/api';
import { getNextRoute } from '@/lib/onboardingSteps';
import Field from '@/components/onboarding/Field';
import StepFooter from '@/components/onboarding/StepFooter';

const MAX_IMAGES = 3;

type ProductImageEntry = {
    url: string;     // preview (blob or server URL)
    file: File | null;
};

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

const EMPTY_FORM = {
    name: '',
    category: 'Smartphones',
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

export default function Step8FirstProduct() {
    const router = useRouter();

    const [tab, setTab] = useState<Tab>('manual');
    const [products, setProducts] = useState<Product[]>([]);
    const [form, setForm] = useState({ ...EMPTY_FORM });

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Bulk
    const fileRef = useRef<HTMLInputElement>(null);
    const [csvRows, setCsvRows] = useState<Product[]>([]);
    const [fileName, setFileName] = useState('');
    const [parsing, setParsing] = useState(false);

    // ── Prefill ──
    useEffect(() => {
        setLoading(true);
        onboarding
            .getStep8()
            .then((data) => {
                setProducts(
                    (data.products || []).map((p) => ({
                        id: p.id ?? uid(),
                        name: p.name,
                        category: p.category_name ?? 'Smartphones',
                        price: p.price,
                        salePrice: p.sale_price ?? '',
                        stock: String(p.stock),
                        sku: p.sku,
                        shortDescription: p.short_description,
                        images: (p.images || []).map((img) => ({
                            url: img.url,
                            file: null,
                        })),
                    })),
                );
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    // ── Manual ──
    const addManual = () => {
        if (!form.name.trim() || !form.price || !form.stock) return;
        setProducts([
            ...products,
            {
                id: uid(),
                name: form.name.trim(),
                category: form.category,
                price: form.price,
                salePrice: form.salePrice,
                stock: form.stock,
                sku: form.sku,
                shortDescription: form.shortDescription,
                images: form.images,
            },
        ]);
        setForm({ ...EMPTY_FORM });
    };

    const removeProduct = (id: string) => {
        const p = products.find((x) => x.id === id);
        p?.images.forEach((img) => {
            if (img.url.startsWith('blob:')) URL.revokeObjectURL(img.url);
        });
        setProducts(products.filter((p) => p.id !== id));
    };

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
                    category: category || 'Smartphones',
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
        setParsing(true);
        setFileName(file.name);
        try {
            const text = await file.text();
            setTimeout(() => {
                setCsvRows(parseCSV(text));
                setParsing(false);
            }, 300);
        } catch {
            setError('Could not read the file.');
            setParsing(false);
        }
    };

    const confirmImport = () => {
        setProducts([...products, ...csvRows]);
        setCsvRows([]);
        setFileName('');
        if (fileRef.current) fileRef.current.value = '';
        setTab('manual');
    };

    const clearCsv = () => {
        setCsvRows([]);
        setFileName('');
        if (fileRef.current) fileRef.current.value = '';
    };

    /* ─── Submit ─────────────────────────────────────────────── */

    const handleContinue = async () => {
        setSaving(true);
        setError(null);

        if (products.length === 0) {
            setError('Add at least one product.');
            setSaving(false);
            return;
        }

        try {
            await onboarding.submitStep8({
                products: products.map((p) => ({
                    name: p.name,
                    category: p.category,
                    price: p.price,
                    sale_price: p.salePrice || undefined,
                    stock: Number(p.stock) || 0,
                    sku: p.sku,
                    short_description: p.shortDescription,
                    images: p.images
                        .map((i) => i.file)
                        .filter((f): f is File => f instanceof File),
                })),
            });
            router.push(getNextRoute('step8'));
        } catch (err) {
            if (err instanceof ApiError) {
                setError(
                    err.nonFieldError() ||
                    Object.values(err.fieldErrors())[0] ||
                    'Please check your input.',
                );
            } else {
                setError('Something went wrong. Please try again.');
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                    Step 8 of 12
                </p>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-950" />
                    Add your products
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                    Add one product, or upload your full catalog from a CSV file.
                </p>
            </div>

            {/* Tabs */}
            <div className="bg-white border border-slate-200 rounded-sm p-1 flex gap-1">
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
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-sm text-xs font-medium transition-colors ${tab === value
                                ? 'bg-blue-950 text-white'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                    </button>
                ))}
            </div>

            {/* ─── Manual tab ─── */}
            {tab === 'manual' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-sm p-5 space-y-4">
                        <Field
                            label="Product name"
                            value={form.name}
                            onChange={(v) => setForm({ ...form, name: v })}
                            placeholder="e.g. Apex Ultra X1 Pro"
                        />

                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                Category
                            </label>
                            <select
                                value={form.category}
                                onChange={(e) =>
                                    setForm({ ...form, category: e.target.value })
                                }
                                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs"
                            >
                                <option>Smartphones</option>
                                <option>Laptops</option>
                                <option>Audio</option>
                                <option>Accessories</option>
                                <option>TVs</option>
                                <option>Gaming</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
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
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Field
                                label="Stock quantity"
                                value={form.stock}
                                onChange={(v) => setForm({ ...form, stock: v })}
                                placeholder="10"
                            />
                            <Field
                                label="SKU"
                                value={form.sku}
                                onChange={(v) => setForm({ ...form, sku: v })}
                                placeholder="auto-generated"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                Short description
                            </label>
                            <textarea
                                rows={2}
                                maxLength={160}
                                value={form.shortDescription}
                                onChange={(e) =>
                                    setForm({ ...form, shortDescription: e.target.value })
                                }
                                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                            />
                            <p className="text-[10px] text-slate-400 text-right mt-0.5">
                                {form.shortDescription.length}/160
                            </p>
                        </div>

                        {/* Image uploader */}
                        <div>
                            <div className="flex items-baseline justify-between mb-2">
                                <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    Product images
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    {form.images.length} of {MAX_IMAGES}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                {form.images.map((img, idx) => (
                                    <div
                                        key={idx}
                                        className="relative aspect-square rounded-sm overflow-hidden border border-slate-200 bg-slate-50"
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
                                            <X className="h-3 w-3 text-red-600" />
                                        </button>
                                    </div>
                                ))}

                                {Array.from({
                                    length: MAX_IMAGES - form.images.length,
                                }).map((_, idx) => (
                                    <label
                                        key={`slot-${idx}`}
                                        className="aspect-square rounded-sm border border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
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

                            <p className="text-[10px] text-slate-500 mt-2">
                                Up to 3 images. First image is used as the primary thumbnail.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={addManual}
                            disabled={!form.name || !form.price || !form.stock}
                            className="w-full bg-blue-950 hover:bg-blue-900 text-white font-medium py-2.5 rounded-sm text-xs disabled:opacity-50"
                        >
                            Add product
                        </button>
                    </div>

                    {/* Live preview */}
                    <div className="lg:col-span-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                            Preview
                        </p>
                        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                            <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden relative">
                                {form.images[0] ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                        src={form.images[0].url}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Package className="h-10 w-10 text-slate-300" />
                                )}
                            </div>

                            {form.images.length > 1 && (
                                <div className="flex gap-1 p-2 border-b border-slate-100">
                                    {form.images.map((img, i) => (
                                        <div
                                            key={i}
                                            className="w-8 h-8 rounded-sm overflow-hidden border border-slate-200"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={img.url}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="p-3">
                                <p className="text-[10px] uppercase text-slate-500">
                                    {form.category}
                                </p>
                                <p className="text-xs font-semibold text-slate-900 mt-0.5 line-clamp-2">
                                    {form.name || 'Product name'}
                                </p>
                                <div className="flex items-baseline gap-1.5 mt-2">
                                    <span className="text-sm font-bold text-slate-900">
                                        KES{' '}
                                        {form.price
                                            ? Number(form.price).toLocaleString()
                                            : '0'}
                                    </span>
                                    {form.salePrice && (
                                        <span className="text-[10px] text-slate-400 line-through">
                                            KES {Number(form.salePrice).toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Upload tab ─── */}
            {tab === 'upload' && (
                <>
                    <div className="bg-blue-50 border border-blue-100 rounded-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold text-blue-950">
                                Start with our CSV template
                            </p>
                            <p className="text-[11px] text-blue-800 mt-0.5 font-mono">
                                name, category, price, sale_price, stock, sku, short_description
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={downloadTemplate}
                            className="inline-flex items-center gap-1.5 bg-white border border-blue-200 hover:bg-blue-50 text-blue-950 font-medium px-3 py-2 rounded-sm text-xs"
                        >
                            <Download className="h-3.5 w-3.5" />
                            Download template
                        </button>
                    </div>

                    <label
                        className={`block border-2 border-dashed rounded-sm p-8 text-center cursor-pointer transition-colors ${fileName
                                ? 'border-emerald-200 bg-emerald-50/30'
                                : 'border-slate-300 hover:border-blue-950 hover:bg-blue-50/20'
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
                                <FileSpreadsheet className="h-8 w-8 mx-auto text-emerald-600" />
                                <p className="text-xs font-semibold text-slate-900 mt-3">
                                    {fileName}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    {csvRows.length} products found
                                </p>
                            </>
                        ) : (
                            <>
                                <Upload className="h-8 w-8 mx-auto text-slate-400" />
                                <p className="text-xs font-semibold text-slate-900 mt-3">
                                    Upload a CSV file
                                </p>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    Drag and drop or click to browse
                                </p>
                            </>
                        )}
                    </label>

                    {parsing && (
                        <div className="flex items-center justify-center gap-2 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Parsing CSV...
                        </div>
                    )}

                    {csvRows.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-sm p-4 space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold text-slate-900">
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {csvRows.slice(0, 6).map((product) => (
                                    <div key={product.id} className="border border-slate-200 rounded-sm p-3">
                                        <p className="text-xs font-semibold text-slate-900 line-clamp-1">
                                            {product.name}
                                        </p>
                                        <p className="text-[10px] text-slate-500 mt-1">
                                            {product.category} • {product.stock} in stock
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {csvRows.length > 6 && (
                                <p className="text-[10px] text-slate-500">
                                    Showing the first 6 products. Import will include all {csvRows.length} rows.
                                </p>
                            )}

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={confirmImport}
                                    className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-xs"
                                >
                                    Import products
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
