// app/auth/onboarding/steps/step7/page.tsx

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    FolderTree,
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

const SUGGESTIONS = [
    'Phones',
    'Laptops',
    'Audio',
    'Accessories',
    'Gaming',
    'Smart Home',
    'TVs',
    'Cameras',
];

type Cat = {
    id: string;
    name: string;
    slug: string;
    description: string;
    imageUrl: string;
    imageFile: File | null;
};

type Tab = 'manual' | 'upload';

function uid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Step7FirstCategory() {
    const router = useRouter();

    const [tab, setTab] = useState<Tab>('manual');
    const [cats, setCats] = useState<Cat[]>([]);

    const [form, setForm] = useState({
        name: '',
        slug: '',
        description: '',
        imageUrl: '',
        imageFile: null as File | null,
    });

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Bulk upload state ──
    const fileRef = useRef<HTMLInputElement>(null);
    const [csvRows, setCsvRows] = useState<Cat[]>([]);
    const [fileName, setFileName] = useState('');
    const [parsing, setParsing] = useState(false);

    // ── Prefill from backend ──
    useEffect(() => {
        setLoading(true);
        onboarding
            .getStep7()
            .then((data) => {
                setCats(
                    (data.categories || []).map((c) => ({
                        id: c.id ?? uid(),
                        name: c.name,
                        slug: c.slug,
                        description: c.description || '',
                        imageUrl: c.image ?? '',
                        imageFile: null,
                    })),
                );
            })
            .catch(() => {
                // If prefill fails, leave empty
            })
            .finally(() => setLoading(false));
    }, []);

    // ── Manual add ──
    const addManual = () => {
        if (!form.name.trim()) return;
        setCats([
            ...cats,
            {
                id: uid(),
                name: form.name.trim(),
                slug:
                    form.slug.trim() ||
                    form.name.toLowerCase().replace(/\s+/g, '-'),
                description: form.description.trim(),
                imageUrl: form.imageUrl,
                imageFile: form.imageFile,
            },
        ]);
        setForm({
            name: '',
            slug: '',
            description: '',
            imageUrl: '',
            imageFile: null,
        });
    };

    const removeCat = (id: string) => {
        // Clean up any object URLs
        const cat = cats.find((c) => c.id === id);
        if (cat?.imageUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(cat.imageUrl);
        }
        setCats(cats.filter((c) => c.id !== id));
    };

    const handleImage = (file?: File) => {
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            setError('Image must be 2MB or smaller.');
            return;
        }
        if (form.imageUrl && form.imageUrl.startsWith('blob:')) {
            URL.revokeObjectURL(form.imageUrl);
        }
        setForm({
            ...form,
            imageFile: file,
            imageUrl: URL.createObjectURL(file),
        });
    };

    /* ─── CSV handling ───────────────────────────────────────── */

    const downloadTemplate = () => {
        const csv =
            'name,slug,description\n' +
            'Smartphones,smartphones,"Latest 5G phones from top brands"\n' +
            'Laptops,laptops,"Powerful laptops for work and play"\n' +
            'Audio,audio,"Headphones, earbuds and speakers"\n';
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'categories-template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const parseCSV = (text: string): Cat[] => {
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (!lines.length) return [];

        const dataRows = lines.slice(1);

        return dataRows
            .map((line, i) => {
                // Match quoted or unquoted cells
                const cells =
                    line
                        .match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
                        ?.map((c) => c.replace(/^"|"$/g, '').trim()) ?? [];

                const [name = '', slug = '', description = ''] = cells;

                return {
                    id: `csv_${i}_${uid()}`,
                    name,
                    slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
                    description,
                    imageUrl: '',
                    imageFile: null,
                };
            })
            .filter((r) => r.name);
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
            // Small delay so the UI shows "Parsing…"
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
        setCats([...cats, ...csvRows]);
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

        if (cats.length === 0) {
            setError('Add at least one category.');
            setSaving(false);
            return;
        }

        const missingName = cats.find((c) => !c.name.trim());
        if (missingName) {
            setError('Every category needs a name.');
            setSaving(false);
            return;
        }

        try {
            await onboarding.submitStep7({
                categories: cats.map((c) => ({
                    name: c.name.trim(),
                    slug:
                        c.slug.trim() ||
                        c.name.toLowerCase().replace(/\s+/g, '-'),
                    description: c.description,
                    image: c.imageFile,
                })),
            });
            router.push(getNextRoute('step7'));
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
                    Step 7 of 12
                </p>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                    <FolderTree className="h-5 w-5 text-blue-950" />
                    Create your categories
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                    Add categories one by one, or upload your full list from a CSV file.
                </p>
            </div>

            {/* Tabs */}
            <div className="bg-white border border-slate-200 rounded-sm p-1 flex gap-1">
                {(
                    [
                        { value: 'manual', label: 'Manual entry', icon: Plus },
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
                <>
                    <div className="flex flex-wrap gap-1.5">
                        {SUGGESTIONS.map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() =>
                                    setForm({
                                        ...form,
                                        name: s,
                                        slug: s.toLowerCase().replace(/\s+/g, '-'),
                                    })
                                }
                                className="text-xs font-medium bg-white border border-slate-200 hover:border-blue-950 hover:bg-blue-50 px-3 py-1.5 rounded-full text-slate-700 transition-colors"
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    <div className="bg-white border border-slate-200 rounded-sm p-5 space-y-4">
                        {/* Image upload */}
                        <div>
                            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                Category image
                            </span>
                            <div className="flex items-center gap-4">
                                <div className="w-24 h-24 rounded-sm bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative">
                                    {form.imageUrl ? (
                                        <>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={form.imageUrl}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (
                                                        form.imageUrl.startsWith(
                                                            'blob:',
                                                        )
                                                    ) {
                                                        URL.revokeObjectURL(
                                                            form.imageUrl,
                                                        );
                                                    }
                                                    setForm({
                                                        ...form,
                                                        imageUrl: '',
                                                        imageFile: null,
                                                    });
                                                }}
                                                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-white/90 flex items-center justify-center"
                                                aria-label="Remove image"
                                            >
                                                <X className="h-3 w-3 text-red-600" />
                                            </button>
                                        </>
                                    ) : (
                                        <ImageIcon className="h-6 w-6 text-slate-400" />
                                    )}
                                </div>
                                <div>
                                    <label className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-xs cursor-pointer">
                                        <Upload className="h-3.5 w-3.5" />
                                        {form.imageUrl ? 'Replace image' : 'Upload image'}
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp"
                                            className="hidden"
                                            onChange={(e) =>
                                                handleImage(e.target.files?.[0])
                                            }
                                        />
                                    </label>
                                    <p className="text-[10px] text-slate-500 mt-1">
                                        PNG, JPG or WEBP · max 2MB · square recommended
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field
                                label="Category name"
                                value={form.name}
                                onChange={(v) =>
                                    setForm({
                                        ...form,
                                        name: v,
                                        slug: v.toLowerCase().replace(/\s+/g, '-'),
                                    })
                                }
                                placeholder="e.g. Smartphones"
                            />
                            <Field
                                label="Slug"
                                value={form.slug}
                                onChange={(v) => setForm({ ...form, slug: v })}
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                Description (optional)
                            </label>
                            <textarea
                                rows={2}
                                value={form.description}
                                onChange={(e) =>
                                    setForm({ ...form, description: e.target.value })
                                }
                                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={addManual}
                            disabled={!form.name.trim()}
                            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs disabled:opacity-50"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add category
                        </button>
                    </div>
                </>
            )}

            {/* ─── Upload tab ─── */}
            {tab === 'upload' && (
                <>
                    <div className="bg-blue-50 border border-blue-100 rounded-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold text-blue-950">
                                Start with our CSV template
                            </p>
                            <p className="text-[11px] text-blue-800 mt-0.5">
                                Columns: <span className="font-mono">name, slug, description</span>
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
                                    {csvRows.length} categories found
                                </p>
                            </>
                        ) : (
                            <>
                                <Upload className="h-8 w-8 mx-auto text-slate-400" />
                                <p className="text-xs font-semibold text-slate-900 mt-3">
                                    Drop your CSV here or click to browse
                                </p>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    Max 5MB · .csv only · Images added separately after import
                                </p>
                            </>
                        )}
                    </label>

                    {parsing && (
                        <p className="text-[11px] text-slate-500 text-center">
                            Parsing CSV…
                        </p>
                    )}

                    {csvRows.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-sm">
                            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    Preview · {csvRows.length} rows
                                </p>
                                <button
                                    type="button"
                                    onClick={clearCsv}
                                    className="text-[11px] text-slate-500 hover:text-red-600"
                                >
                                    Clear
                                </button>
                            </div>
                            <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                                {csvRows.map((r) => (
                                    <li key={r.id} className="flex items-center gap-3 p-3">
                                        <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center text-xs font-bold shrink-0">
                                            {r.name[0]}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-semibold text-slate-900 truncate">
                                                {r.name}
                                            </p>
                                            <p className="text-[10px] text-slate-500 font-mono truncate">
                                                /{r.slug}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setCsvRows(
                                                    csvRows.filter((x) => x.id !== r.id),
                                                )
                                            }
                                            className="text-slate-400 hover:text-red-600 p-1.5"
                                            aria-label="Remove row"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <div className="p-3 border-t border-slate-100 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={clearCsv}
                                    className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-sm text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmImport}
                                    className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs"
                                >
                                    <Check className="h-3.5 w-3.5" />
                                    Import {csvRows.length} categories
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ─── Shared list ─── */}
            {cats.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-sm">
                    <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Ready to save · {cats.length}
                        </p>
                        <button
                            type="button"
                            onClick={() => setCats([])}
                            className="text-[11px] text-slate-500 hover:text-red-600 inline-flex items-center gap-1"
                        >
                            <Trash2 className="h-3 w-3" /> Clear all
                        </button>
                    </div>
                    <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                        {cats.map((c) => (
                            <li
                                key={c.id}
                                className="flex items-center justify-between p-3"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="w-9 h-9 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                                        {c.imageUrl ? (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img
                                                src={c.imageUrl}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            c.name[0]
                                        )}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-slate-900 truncate">
                                            {c.name}
                                        </p>
                                        <p className="text-[10px] text-slate-500 font-mono truncate">
                                            /{c.slug}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeCat(c.id)}
                                    className="text-slate-400 hover:text-red-600 p-1.5"
                                    aria-label="Remove category"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-sm px-3 py-2">
                    {error}
                </div>
            )}

            <StepFooter
                onContinue={handleContinue}
                loading={saving}
                currentSlug="step7"
                optional={false}
            />
        </div>
    );
}