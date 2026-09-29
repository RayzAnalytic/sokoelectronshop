"use client";

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    X,
    Upload,
    FileSpreadsheet,
    Download,
    CheckCircle2,
    AlertCircle,
    Trash2,
    Package,
    ArrowRight,
    RefreshCw,
} from "lucide-react";

type Props = {
    open: boolean;
    onClose: () => void;
    onSave?: (products: ImportedProduct[]) => void;
};

export type ImportedProduct = {
    name: string;
    category: string;
    brand: string;
    price: string;
    salePrice: string;
    stock: string;
    sku: string;
    shortDescription: string;
    status: "published" | "draft";
};

type ParsedRow = {
    index: number;
    data: ImportedProduct;
    errors: string[];
    warnings: string[];
};

const CATEGORIES = [
    "Smartphones",
    "Laptops",
    "Audio",
    "Accessories",
    "TVs",
    "Gaming",
    "Cameras",
    "Networking",
];

const BRANDS = [
    "Apex",
    "Zenith",
    "SonicWave",
    "Vizion",
    "Nexus",
    "Pulse",
    "Quantum",
    "Aero",
    "Samsung",
    "HP",
    "Apple",
    "Sony",
    "JBL",
    "TP-Link",
    "Xiaomi",
    "Other",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 500;

const HEADER_ALIASES: Record<string, keyof ImportedProduct> = {
    name: "name",
    "product name": "name",
    productname: "name",
    title: "name",
    category: "category",
    brand: "brand",
    price: "price",
    "price (kes)": "price",
    "price kes": "price",
    saleprice: "salePrice",
    "sale price": "salePrice",
    sale_price: "salePrice",
    stock: "stock",
    quantity: "stock",
    qty: "stock",
    sku: "sku",
    shortdescription: "shortDescription",
    "short description": "shortDescription",
    description: "shortDescription",
    status: "status",
};

// ─────────────────────────────────────────────────────────────────────────────
// CSV parsing
// ─────────────────────────────────────────────────────────────────────────────
function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;
    let i = 0;

    // Strip BOM
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
        if (c === ",") {
            row.push(field);
            field = "";
            i++;
            continue;
        }
        if (c === "\r") {
            i++;
            continue;
        }
        if (c === "\n") {
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
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
    return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function normalizeHeader(h: string): string {
    return h
        .trim()
        .toLowerCase()
        .replace(/[_\-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function parseRows(raw: string[][]): { rows: ParsedRow[]; error?: string } {
    if (raw.length < 2) {
        return { rows: [], error: "File must include a header row and at least one product." };
    }

    const headerRow = raw[0].map(normalizeHeader);
    const columnMap: Partial<Record<keyof ImportedProduct, number>> = {};

    headerRow.forEach((h, idx) => {
        const key = HEADER_ALIASES[h];
        if (key && columnMap[key] === undefined) columnMap[key] = idx;
    });

    if (columnMap.name === undefined) {
        return {
            rows: [],
            error: "Header row must include a 'Name' column. Download the template for reference.",
        };
    }

    const dataRows = raw.slice(1).slice(0, MAX_ROWS);
    const rows: ParsedRow[] = dataRows.map((cells, i) => {
        const get = (key: keyof ImportedProduct) => {
            const idx = columnMap[key];
            if (idx === undefined) return "";
            return (cells[idx] ?? "").trim();
        };

        const name = get("name");
        const price = get("price").replace(/[^\d.]/g, "");
        const salePrice = get("salePrice").replace(/[^\d.]/g, "");
        const stockRaw = get("stock").replace(/[^\d]/g, "");
        const stock = stockRaw || "0";
        const category = get("category") || "Accessories";
        const brand = get("brand") || "Other";
        const statusRaw = (get("status") || "published").toLowerCase();
        const status: "published" | "draft" =
            statusRaw === "draft" ? "draft" : "published";

        const errors: string[] = [];
        const warnings: string[] = [];

        if (!name) errors.push("Name is required");
        if (!price) errors.push("Price is required");
        else if (Number(price) <= 0) errors.push("Price must be greater than 0");
        if (salePrice && Number(salePrice) >= Number(price)) {
            warnings.push("Sale price is not lower than price");
        }
        if (!CATEGORIES.includes(category)) {
            warnings.push(`Unknown category "${category}" — will use Accessories`);
        }
        if (!BRANDS.includes(brand)) {
            warnings.push(`Unknown brand "${brand}" — will use Other`);
        }

        return {
            index: i + 2, // +2 because header is row 1
            data: {
                name,
                category: CATEGORIES.includes(category) ? category : "Accessories",
                brand: BRANDS.includes(brand) ? brand : "Other",
                price,
                salePrice,
                stock,
                sku: get("sku"),
                shortDescription: get("shortDescription").slice(0, 160),
                status,
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
        "name",
        "category",
        "brand",
        "price",
        "salePrice",
        "stock",
        "sku",
        "shortDescription",
        "status",
    ];
    const example = [
        "Apex Ultra X1 Pro 5G",
        "Smartphones",
        "Apex",
        "89900",
        "79900",
        "10",
        "APX-X1-5G",
        "Flagship 5G smartphone with 120Hz display.",
        "published",
    ];
    const csv =
        headers.join(",") + "\n" +
        example.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",") + "\n";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function BulkUploadModal({ open, onClose, onSave }: Props) {
    const [fileName, setFileName] = useState("");
    const [rows, setRows] = useState<ParsedRow[]>([]);
    const [parseError, setParseError] = useState("");
    const [dragging, setDragging] = useState(false);
    const [busy, setBusy] = useState(false);
    const [onlyErrors, setOnlyErrors] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset when opened
    useEffect(() => {
        if (open) {
            setFileName("");
            setRows([]);
            setParseError("");
            setOnlyErrors(false);
        }
    }, [open]);

    // Lock body scroll
    useEffect(() => {
        if (!open) return;
        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = original;
        };
    }, [open]);

    // ESC to close
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const handleFile = useCallback(async (file: File | null | undefined) => {
        setParseError("");
        if (!file) return;
        if (file.size > MAX_FILE_SIZE) {
            setParseError("File is too large. Maximum size is 5 MB.");
            return;
        }
        if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
            setParseError("Please upload a .csv file. Download the template for reference.");
            return;
        }

        setBusy(true);
        try {
            const text = await file.text();
            const raw = parseCsv(text);
            const result = parseRows(raw);
            if (result.error) {
                setParseError(result.error);
                setRows([]);
                setFileName("");
            } else {
                setRows(result.rows);
                setFileName(file.name);
            }
        } catch {
            setParseError("Could not read that file. Try again or re-export from Excel.");
        } finally {
            setBusy(false);
        }
    }, []);

    const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setDragging(false);
        void handleFile(e.dataTransfer.files?.[0]);
    };

    const clearFile = () => {
        setFileName("");
        setRows([]);
        setParseError("");
        setOnlyErrors(false);
        if (inputRef.current) inputRef.current.value = "";
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
        const products = rows
            .filter((r) => r.errors.length === 0)
            .map((r) => r.data);
        onSave?.(products);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white border border-slate-200 rounded-md w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="h-7 w-7 rounded bg-blue-950 text-white flex items-center justify-center">
                            <FileSpreadsheet className="h-4 w-4" />
                        </span>
                        <div>
                            <h2 className="text-[13px] font-semibold text-slate-900">
                                Bulk import products
                            </h2>
                            <p className="text-[13px] text-slate-500">
                                Upload a CSV file to add many products at once
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="h-8 w-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
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
                                className={`relative flex flex-col items-center justify-center rounded-md border-2 border-dashed transition-colors cursor-pointer min-h-[280px] px-6 text-center ${dragging
                                        ? "border-blue-950 bg-blue-50/40"
                                        : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
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
                                    {busy ? "Reading file…" : "Click to upload or drag & drop"}
                                </p>
                                <p className="text-[13px] text-slate-500 mt-1">
                                    CSV only · up to 5 MB · max 500 products
                                </p>

                                {parseError && (
                                    <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-left max-w-md">
                                        <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                                        <p className="text-[13px] text-red-700">{parseError}</p>
                                    </div>
                                )}
                            </label>

                            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5">
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
                                    className="shrink-0 inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-md text-[13px] transition-colors"
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
                            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                    <FileSpreadsheet className="h-4 w-4 text-blue-950 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-medium text-slate-900 truncate">
                                            {fileName}
                                        </p>
                                        <p className="text-[13px] text-slate-500">
                                            {stats.total} row{stats.total === 1 ? "" : "s"} detected
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={clearFile}
                                        className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-1.5 rounded-md text-[13px] transition-colors"
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Replace
                                    </button>
                                    <button
                                        type="button"
                                        onClick={clearFile}
                                        aria-label="Remove file"
                                        className="h-8 w-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-red-600 transition-colors"
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
                                    tone={stats.withErrors > 0 ? "danger" : "muted"}
                                />
                                <SummaryCard
                                    label="With warnings"
                                    value={stats.withWarnings.toString()}
                                    tone={stats.withWarnings > 0 ? "warning" : "muted"}
                                />
                            </div>

                            {/* Filter */}
                            {stats.withErrors > 0 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setOnlyErrors(false)}
                                        className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${!onlyErrors
                                                ? "bg-blue-950 text-white border-blue-950"
                                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                            }`}
                                    >
                                        All rows
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setOnlyErrors(true)}
                                        className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${onlyErrors
                                                ? "bg-blue-950 text-white border-blue-950"
                                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                            }`}
                                    >
                                        Errors only ({stats.withErrors})
                                    </button>
                                </div>
                            )}

                            {/* Preview table */}
                            <div className="border border-slate-200 rounded-md overflow-hidden">
                                <div className="overflow-x-auto max-h-[360px]">
                                    <table className="w-full text-[13px]">
                                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                                                <th className="font-medium px-3 py-2 w-12">Row</th>
                                                <th className="font-medium px-3 py-2 w-10"></th>
                                                <th className="font-medium px-3 py-2">Product</th>
                                                <th className="font-medium px-3 py-2">Category</th>
                                                <th className="font-medium px-3 py-2">Brand</th>
                                                <th className="font-medium px-3 py-2 text-right">Price</th>
                                                <th className="font-medium px-3 py-2 text-right">Stock</th>
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
                                                                ? "bg-red-50/40"
                                                                : hasWarning
                                                                    ? "bg-amber-50/30"
                                                                    : "hover:bg-slate-50/60"
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
                                                            <div className="font-medium text-slate-900 truncate max-w-[220px]">
                                                                {row.data.name || (
                                                                    <span className="italic text-slate-400">
                                                                        Missing name
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {hasError && (
                                                                <p className="text-[11px] text-red-600 mt-0.5">
                                                                    {row.errors.join(" · ")}
                                                                </p>
                                                            )}
                                                            {hasWarning && (
                                                                <p className="text-[11px] text-amber-700 mt-0.5">
                                                                    {row.warnings.join(" · ")}
                                                                </p>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-600">
                                                            {row.data.category}
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-600">
                                                            {row.data.brand}
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                                                            {row.data.price
                                                                ? `KES ${Number(row.data.price).toLocaleString()}`
                                                                : "—"}
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                                                            {row.data.stock}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <span
                                                                className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded ${row.data.status === "published"
                                                                        ? "bg-emerald-50 text-emerald-700"
                                                                        : "bg-amber-50 text-amber-700"
                                                                    }`}
                                                            >
                                                                {row.data.status === "published"
                                                                    ? "Published"
                                                                    : "Draft"}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeRow(row.index)}
                                                                aria-label="Remove row"
                                                                className="h-7 w-7 rounded-md hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors"
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
                            : "CSV must include a Name and Price column"}
                    </p>
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-md text-[13px] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleImport}
                            disabled={!canImport}
                            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-md text-[13px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Import {stats.valid > 0 ? stats.valid : ""} product
                            {stats.valid === 1 ? "" : "s"}
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
    tone = "default",
}: {
    label: string;
    value: string;
    tone?: "default" | "success" | "danger" | "warning" | "muted";
}) {
    const toneCls = {
        default: "bg-white border-slate-200 text-slate-900",
        success: "bg-emerald-50 border-emerald-200 text-emerald-800",
        danger: "bg-red-50 border-red-200 text-red-800",
        warning: "bg-amber-50 border-amber-200 text-amber-800",
        muted: "bg-slate-50 border-slate-200 text-slate-500",
    }[tone];

    return (
        <div className={`border rounded-md p-2.5 ${toneCls}`}>
            <p className="text-[13px] font-medium opacity-80">{label}</p>
            <p className="text-[18px] font-bold tabular-nums mt-0.5">{value}</p>
        </div>
    );
}