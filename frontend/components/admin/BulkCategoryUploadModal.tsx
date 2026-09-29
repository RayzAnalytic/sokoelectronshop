'use client';

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    X,
    Upload,
    FileSpreadsheet,
    Download,
    CheckCircle2,
    AlertCircle,
    Trash2,
    RefreshCw,
    Check,
    ArrowRight,
    Image as ImageIcon,
} from 'lucide-react';

type CategoryStatus = 'Active' | 'Inactive';

export interface ImportedCategory {
    name: string;
    slug: string;
    parentName: string;
    description: string;
    image: string;
    status: CategoryStatus;
    displayOrder: number;
}

interface Props {
    open: boolean;
    onClose: () => void;
    onSave: (categories: ImportedCategory[]) => void;
    /** Names or slugs of existing categories — used to resolve parents and detect duplicates. */
    existingCategories: { name: string; slug: string }[];
}

type ParsedRow = {
    index: number;
    data: ImportedCategory;
    errors: string[];
    warnings: string[];
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 500;

const HEADER_ALIASES: Record<string, keyof ImportedCategory> = {
    name: 'name',
    'category name': 'name',
    category: 'name',
    title: 'name',
    slug: 'slug',
    parent: 'parentName',
    'parent category': 'parentName',
    'parent name': 'parentName',
    parentname: 'parentName',
    description: 'description',
    'short description': 'description',
    image: 'image',
    'image url': 'image',
    imageurl: 'image',
    status: 'status',
    'display order': 'displayOrder',
    displayorder: 'displayOrder',
    order: 'displayOrder',
    position: 'displayOrder',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function slugify(s: string): string {
    return s
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    while (i < text.length) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i += 2;
                    continue;
                }
                inQuotes = false;
                i++;
                continue;
            }
            field += c;
            i++;
            continue;
        }
        if (c === '"') {
            inQuotes = true;
            i++;
            continue;
        }
        if (c === ',') {
            row.push(field);
            field = '';
            i++;
            continue;
        }
        if (c === '\r') {
            i++;
            continue;
        }
        if (c === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
            i++;
            continue;
        }
        field += c;
        i++;
    }
    if (field.length || row.length) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function normalizeHeader(h: string): string {
    return h
        .trim()
        .toLowerCase()
        .replace(/[_\-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseRows(
    raw: string[][],
    existing: { name: string; slug: string }[],
): { rows: ParsedRow[]; error?: string } {
    if (raw.length < 2) {
        return {
            rows: [],
            error:
                'File must include a header row and at least one category.',
        };
    }

    const headerRow = raw[0].map(normalizeHeader);
    const columnMap: Partial<Record<keyof ImportedCategory, number>> = {};

    headerRow.forEach((h, idx) => {
        const key = HEADER_ALIASES[h];
        if (key && columnMap[key] === undefined) columnMap[key] = idx;
    });

    if (columnMap.name === undefined) {
        return {
            rows: [],
            error:
                "Header row must include a 'Name' column. Download the template for reference.",
        };
    }

    const existingLowerNames = new Set(
        existing.map((c) => c.name.toLowerCase()),
    );
    const existingSlugs = new Set(existing.map((c) => c.slug));

    const seenInFile = new Set<string>();
    const seenSlugs = new Set<string>();

    const dataRows = raw.slice(1).slice(0, MAX_ROWS);

    const rows: ParsedRow[] = dataRows.map((cells, i) => {
        const get = (key: keyof ImportedCategory) => {
            const idx = columnMap[key];
            if (idx === undefined) return '';
            return (cells[idx] ?? '').trim();
        };

        const name = get('name');
        const slugInput = get('slug');
        const slug = slugify(slugInput || name);
        const parentName = get('parentName');
        const description = get('description');
        const image = get('image');
        const statusRaw = (get('status') || 'Active').toLowerCase();
        const status: CategoryStatus =
            statusRaw === 'inactive' ? 'Inactive' : 'Active';
        const orderRaw = get('displayOrder');
        const displayOrder = orderRaw
            ? Math.max(1, parseInt(orderRaw, 10) || 1)
            : i + 1;

        const errors: string[] = [];
        const warnings: string[] = [];

        if (!name) errors.push('Name is required');

        if (name && existingLowerNames.has(name.toLowerCase())) {
            errors.push('A category with this name already exists');
        }
        if (slug && existingSlugs.has(slug)) {
            errors.push('A category with this slug already exists');
        }

        const nameKey = name.toLowerCase();
        if (name && seenInFile.has(nameKey)) {
            errors.push('Duplicate name within this file');
        } else if (name) {
            seenInFile.add(nameKey);
        }

        if (slug && seenSlugs.has(slug)) {
            errors.push('Duplicate slug within this file');
        } else if (slug) {
            seenSlugs.add(slug);
        }

        if (parentName) {
            const known =
                existingLowerNames.has(parentName.toLowerCase()) ||
                existingSlugs.has(slugify(parentName)) ||
                seenInFile.has(parentName.toLowerCase());
            if (!known) {
                warnings.push(
                    `Parent "${parentName}" not found — will import as root`,
                );
            }
        }

        if (!image) {
            warnings.push('No image provided');
        }

        return {
            index: i + 2,
            data: {
                name,
                slug,
                parentName,
                description,
                image,
                status,
                displayOrder,
            },
            errors,
            warnings,
        };
    });

    return { rows };
}

// ─────────────────────────────────────────────────────────────────────────────
// Template
// ─────────────────────────────────────────────────────────────────────────────
function downloadTemplate() {
    const headers = [
        'name',
        'slug',
        'parent',
        'description',
        'image',
        'status',
        'displayOrder',
    ];
    const examples = [
        [
            'Smart Home & IoT',
            'smart-home-iot',
            '',
            'Connected devices for modern homes.',
            'https://example.com/smart-home.jpg',
            'Active',
            '1',
        ],
        [
            'Smart Lighting',
            'smart-lighting',
            'Smart Home & IoT',
            'Bulbs, strips, and smart switches.',
            'https://example.com/lighting.jpg',
            'Active',
            '2',
        ],
        [
            'Security Cameras',
            'security-cameras',
            'Smart Home & IoT',
            'Indoor and outdoor IP cameras.',
            '',
            'Inactive',
            '3',
        ],
    ];
    const csv =
        headers.join(',') +
        '\n' +
        examples
            .map((row) =>
                row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','),
            )
            .join('\n') +
        '\n';

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'categories-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function BulkCategoryUploadModal({
    open,
    onClose,
    onSave,
    existingCategories,
}: Props) {
    const [fileName, setFileName] = useState('');
    const [rows, setRows] = useState<ParsedRow[]>([]);
    const [parseError, setParseError] = useState('');
    const [dragging, setDragging] = useState(false);
    const [busy, setBusy] = useState(false);
    const [onlyErrors, setOnlyErrors] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setFileName('');
            setRows([]);
            setParseError('');
            setOnlyErrors(false);
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const original = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = original;
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const handleFile = useCallback(
        async (file: File | null | undefined) => {
            setParseError('');
            if (!file) return;
            if (file.size > MAX_FILE_SIZE) {
                setParseError('File is too large. Maximum size is 5 MB.');
                return;
            }
            if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
                setParseError(
                    'Please upload a .csv file. Download the template for reference.',
                );
                return;
            }

            setBusy(true);
            try {
                const text = await file.text();
                const raw = parseCsv(text);
                const result = parseRows(raw, existingCategories);
                if (result.error) {
                    setParseError(result.error);
                    setRows([]);
                    setFileName('');
                } else {
                    setRows(result.rows);
                    setFileName(file.name);
                }
            } catch {
                setParseError(
                    'Could not read that file. Try again or re-export from Excel.',
                );
            } finally {
                setBusy(false);
            }
        },
        [existingCategories],
    );

    const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setDragging(false);
        void handleFile(e.dataTransfer.files?.[0]);
    };

    const clearFile = () => {
        setFileName('');
        setRows([]);
        setParseError('');
        setOnlyErrors(false);
        if (inputRef.current) inputRef.current.value = '';
    };

    const removeRow = (idx: number) => {
        setRows((prev) => prev.filter((r) => r.index !== idx));
    };

    const stats = useMemo(() => {
        const valid = rows.filter((r) => r.errors.length === 0).length;
        const withErrors = rows.length - valid;
        const withWarnings = rows.filter(
            (r) => r.errors.length === 0 && r.warnings.length > 0,
        ).length;
        return { total: rows.length, valid, withErrors, withWarnings };
    }, [rows]);

    const visibleRows = useMemo(
        () => (onlyErrors ? rows.filter((r) => r.errors.length > 0) : rows),
        [rows, onlyErrors],
    );

    if (!open) return null;

    const canImport = stats.valid > 0;

    const handleImport = () => {
        if (!canImport) return;
        const categories = rows
            .filter((r) => r.errors.length === 0)
            .map((r) => r.data);
        onSave(categories);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
            onClick={onClose}
        >
            <div
                className="bg-white border border-slate-200 rounded-sm w-full max-w-5xl max-h-[92vh] flex flex-col shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="h-7 w-7 rounded-sm bg-blue-950 text-white flex items-center justify-center">
                            <FileSpreadsheet className="h-4 w-4" />
                        </span>
                        <div>
                            <h2 className="text-[15px] font-semibold text-slate-900">
                                Bulk import categories
                            </h2>
                            <p className="text-[13px] text-slate-500">
                                Upload a CSV file to add many categories at once
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* ── Body ────────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-3">
                    {rows.length === 0 ? (
                        // ─── Empty state: dropzone ─────────────────────────────
                        <div className="space-y-3">
                            <label
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragging(true);
                                }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={onDrop}
                                className={`relative flex flex-col items-center justify-center rounded-sm border-2 border-dashed transition-colors cursor-pointer min-h-[280px] px-6 text-center ${dragging
                                        ? 'border-blue-950 bg-blue-50/40'
                                        : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                                    }`}
                            >
                                <input
                                    ref={inputRef}
                                    type="file"
                                    accept=".csv,text/csv"
                                    className="hidden"
                                    onChange={(e) => void handleFile(e.target.files?.[0])}
                                />

                                <span className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                                    {busy ? (
                                        <RefreshCw className="h-6 w-6 text-slate-400 animate-spin" />
                                    ) : (
                                        <Upload className="h-6 w-6 text-slate-500" />
                                    )}
                                </span>

                                <p className="text-[14px] font-medium text-slate-900">
                                    {busy ? 'Reading file…' : 'Click to upload or drag & drop'}
                                </p>
                                <p className="text-[13px] text-slate-500 mt-1">
                                    CSV only · up to 5 MB · max 500 categories
                                </p>

                                {parseError && (
                                    <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-sm px-3 py-2 text-left max-w-md">
                                        <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                                        <p className="text-[13px] text-red-700">{parseError}</p>
                                    </div>
                                )}
                            </label>

                            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-sm px-3 py-2.5">
                                <div className="flex items-start gap-2">
                                    <FileSpreadsheet className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[13px] font-medium text-slate-900">
                                            Don&apos;t have a CSV yet?
                                        </p>
                                        <p className="text-[13px] text-slate-500">
                                            Download the template with the correct column names.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={downloadTemplate}
                                    className="shrink-0 inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] transition-colors"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    Template
                                </button>
                            </div>
                        </div>
                    ) : (
                        // ─── Preview state ─────────────────────────────────────
                        <div className="space-y-3">
                            {/* File bar */}
                            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-sm px-3 py-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                    <FileSpreadsheet className="h-4 w-4 text-blue-950 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-medium text-slate-900 truncate">
                                            {fileName}
                                        </p>
                                        <p className="text-[13px] text-slate-500">
                                            {stats.total} row{stats.total === 1 ? '' : 's'} detected
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={clearFile}
                                        className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-1.5 rounded-sm text-[13px] transition-colors"
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Replace
                                    </button>
                                    <button
                                        type="button"
                                        onClick={clearFile}
                                        aria-label="Remove file"
                                        className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-red-600 transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <SummaryCard label="Total rows" value={stats.total.toString()} />
                                <SummaryCard
                                    label="Ready to import"
                                    value={stats.valid.toString()}
                                    tone="success"
                                />
                                <SummaryCard
                                    label="With errors"
                                    value={stats.withErrors.toString()}
                                    tone={stats.withErrors > 0 ? 'danger' : 'muted'}
                                />
                                <SummaryCard
                                    label="With warnings"
                                    value={stats.withWarnings.toString()}
                                    tone={stats.withWarnings > 0 ? 'warning' : 'muted'}
                                />
                            </div>

                            {/* Filter */}
                            {stats.withErrors > 0 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setOnlyErrors(false)}
                                        className={`px-3 py-1.5 rounded-sm text-[13px] font-medium border transition-colors ${!onlyErrors
                                                ? 'bg-blue-950 text-white border-blue-950'
                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        All rows
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setOnlyErrors(true)}
                                        className={`px-3 py-1.5 rounded-sm text-[13px] font-medium border transition-colors ${onlyErrors
                                                ? 'bg-blue-950 text-white border-blue-950'
                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        Errors only ({stats.withErrors})
                                    </button>
                                </div>
                            )}

                            {/* Preview table */}
                            <div className="border border-slate-200 rounded-sm overflow-hidden">
                                <div className="overflow-x-auto max-h-[360px]">
                                    <table className="w-full text-[13px]">
                                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                                                <th className="font-medium px-3 py-2 w-12">Row</th>
                                                <th className="font-medium px-3 py-2 w-10"></th>
                                                <th className="font-medium px-3 py-2 w-14">Image</th>
                                                <th className="font-medium px-3 py-2">Category</th>
                                                <th className="font-medium px-3 py-2">Slug</th>
                                                <th className="font-medium px-3 py-2">Parent</th>
                                                <th className="font-medium px-3 py-2 text-center">Order</th>
                                                <th className="font-medium px-3 py-2">Status</th>
                                                <th className="font-medium px-3 py-2 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleRows.map((row) => {
                                                const hasError = row.errors.length > 0;
                                                const hasWarning = !hasError && row.warnings.length > 0;
                                                return (
                                                    <tr
                                                        key={row.index}
                                                        className={`border-b last:border-b-0 border-slate-100 ${hasError
                                                                ? 'bg-red-50/40'
                                                                : hasWarning
                                                                    ? 'bg-amber-50/30'
                                                                    : 'hover:bg-slate-50/60'
                                                            }`}
                                                    >
                                                        <td className="px-3 py-2 text-slate-400 tabular-nums">
                                                            {row.index}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {hasError ? (
                                                                <AlertCircle className="h-4 w-4 text-red-500" />
                                                            ) : hasWarning ? (
                                                                <AlertCircle className="h-4 w-4 text-amber-500" />
                                                            ) : (
                                                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="w-9 h-9 rounded-sm overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
                                                                {row.data.image ? (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img
                                                                        src={row.data.image}
                                                                        alt=""
                                                                        className="w-full h-full object-cover"
                                                                        onError={(e) => {
                                                                            (
                                                                                e.currentTarget as HTMLImageElement
                                                                            ).style.display = 'none';
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <ImageIcon className="w-4 h-4 text-slate-400" />
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="font-medium text-slate-900 truncate max-w-[220px]">
                                                                {row.data.name || (
                                                                    <span className="italic text-slate-400">
                                                                        Missing name
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {row.data.description && (
                                                                <p className="text-[11px] text-slate-500 truncate max-w-[220px]">
                                                                    {row.data.description}
                                                                </p>
                                                            )}
                                                            {hasError && (
                                                                <p className="text-[11px] text-red-600 mt-0.5">
                                                                    {row.errors.join(' · ')}
                                                                </p>
                                                            )}
                                                            {hasWarning && (
                                                                <p className="text-[11px] text-amber-700 mt-0.5">
                                                                    {row.warnings.join(' · ')}
                                                                </p>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-500 font-mono truncate max-w-[180px]">
                                                            {row.data.slug || '—'}
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-600">
                                                            {row.data.parentName || (
                                                                <span className="text-slate-400">Root</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-center text-slate-700 tabular-nums">
                                                            {row.data.displayOrder}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <span
                                                                className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-sm ${row.data.status === 'Active'
                                                                        ? 'bg-emerald-50 text-emerald-700'
                                                                        : 'bg-slate-100 text-slate-600'
                                                                    }`}
                                                            >
                                                                {row.data.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeRow(row.index)}
                                                                aria-label="Remove row"
                                                                className="h-7 w-7 rounded-sm hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {visibleRows.length === 0 && (
                                                <tr>
                                                    <td
                                                        colSpan={9}
                                                        className="px-3 py-8 text-center text-slate-500"
                                                    >
                                                        No rows to show.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {stats.withErrors > 0 && (
                                <p className="text-[13px] text-slate-500 flex items-center gap-1.5">
                                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                    Rows with errors will be skipped. Fix them in your CSV and
                                    re-upload, or import the rest now.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Footer ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-slate-200 shrink-0 bg-white">
                    <p className="text-[13px] text-slate-500 hidden sm:block">
                        {rows.length > 0
                            ? `${stats.valid} of ${stats.total} ready to import`
                            : 'CSV must include a Name column'}
                    </p>
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleImport}
                            disabled={!canImport}
                            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Check className="w-3.5 h-3.5" />
                            Import {stats.valid > 0 ? stats.valid : ''} categor
                            {stats.valid === 1 ? 'y' : 'ies'}
                            {canImport && <ArrowRight className="h-3.5 w-3.5" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary card
// ─────────────────────────────────────────────────────────────────────────────
function SummaryCard({
    label,
    value,
    tone = 'default',
}: {
    label: string;
    value: string;
    tone?: 'default' | 'success' | 'danger' | 'warning' | 'muted';
}) {
    const toneCls = {
        default: 'bg-white border-slate-200 text-slate-900',
        success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        danger: 'bg-red-50 border-red-200 text-red-800',
        warning: 'bg-amber-50 border-amber-200 text-amber-800',
        muted: 'bg-slate-50 border-slate-200 text-slate-500',
    }[tone];

    return (
        <div className={`border rounded-sm p-2.5 ${toneCls}`}>
            <p className="text-[13px] font-medium opacity-80">{label}</p>
            <p className="text-[18px] font-bold tabular-nums mt-0.5">{value}</p>
        </div>
    );
}