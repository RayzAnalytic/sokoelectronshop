"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    X, Plus, Image as ImageIcon, Package, Loader2, AlertCircle,
    ChevronDown, Check, Search,
} from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import type { AdminBrandRef, AdminCategoryRef } from "@/lib/admin-types";

type Props = {
    open: boolean;
    onClose: () => void;
    onSave?: (data: any) => Promise<void> | void;
};

const MAX_IMAGES = 3;
const MAX_FILE_MB = 2;

const EMPTY = {
    name: "",
    category: "",
    brand: "",
    price: "",
    salePrice: "",
    stock: "",
    lowStockThreshold: "10",
    sku: "",
    shortDescription: "",
    status: "published" as "published" | "draft",
    featured: false,
    images: [] as string[],
};

/** Convert a File to a base64 data URL. */
function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

export default function AddProductModal({ open, onClose, onSave }: Props) {
    const [form, setForm] = useState(EMPTY);
    const [brands, setBrands] = useState<AdminBrandRef[]>([]);
    const [categories, setCategories] = useState<AdminCategoryRef[]>([]);
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Lock body scroll while open
    useEffect(() => {
        if (!open) return;
        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = original;
        };
    }, [open]);

    // Close on ESC (but not while saving)
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !saving) onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose, saving]);

    // Reset form + load options when the modal opens
    useEffect(() => {
        if (!open) return;

        setForm(EMPTY);
        setError("");
        setLoadingOptions(true);

        // `.refs()` hits the storefront endpoints that return flat {id, name}
        // pairs. `.list()` would return full admin shapes (brands) or a
        // nested tree (categories) — wrong for a simple dropdown.
        Promise.all([
            adminApi.brands.refs(),
            adminApi.categories.refs(),
        ])
            .then(([brandList, categoryList]) => {
                setBrands(brandList);
                setCategories(categoryList);

                setForm((prev) => ({
                    ...prev,
                    brand: prev.brand || brandList[0]?.name || "",
                    category: prev.category || categoryList[0]?.name || "",
                }));
            })
            .catch(() => {
                setError("Could not load brands and categories.");
            })
            .finally(() => {
                setLoadingOptions(false);
            });
    }, [open]);

    if (!open) return null;

    const addImages = async (files: FileList | null) => {
        if (!files) return;

        const remaining = MAX_IMAGES - form.images.length;
        if (remaining <= 0) {
            setError(`Maximum ${MAX_IMAGES} images.`);
            return;
        }

        const incoming = Array.from(files).slice(0, remaining);
        const accepted: string[] = [];
        const rejected: string[] = [];

        for (const file of incoming) {
            if (!file.type.startsWith("image/")) {
                rejected.push(`${file.name}: not an image`);
                continue;
            }
            if (file.size > MAX_FILE_MB * 1024 * 1024) {
                rejected.push(`${file.name}: over ${MAX_FILE_MB}MB`);
                continue;
            }
            try {
                const url = await fileToDataUrl(file);
                accepted.push(url);
            } catch {
                rejected.push(`${file.name}: could not read`);
            }
        }

        if (accepted.length > 0) {
            setForm((prev) => ({
                ...prev,
                images: [...prev.images, ...accepted],
            }));
        }

        if (rejected.length > 0) {
            setError(rejected.join(" · "));
        } else {
            setError("");
        }

        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeImage = (idx: number) =>
        setForm((prev) => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== idx),
        }));

    const canSave =
        form.name.trim().length > 0 &&
        form.price.trim().length > 0 &&
        form.stock.trim().length > 0 &&
        form.brand.length > 0 &&
        form.category.length > 0;

    const handleSave = async () => {
        if (!canSave || saving) return;

        setSaving(true);
        setError("");

        try {
            await onSave?.(form);
            onClose();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Could not save the product.",
            );
        } finally {
            setSaving(false);
        }
    };

    const brandOptions = brands.map((b) => ({ value: b.name, label: b.name }));
    const categoryOptions = categories.map((c) => ({ value: c.name, label: c.name }));

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => !saving && onClose()}
        >
            <div
                className="bg-white border border-slate-200 rounded-md w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="h-7 w-7 rounded bg-blue-950 text-white flex items-center justify-center">
                            <Package className="h-4 w-4" />
                        </span>
                        <div>
                            <h2 className="text-[13px] font-semibold text-slate-900">
                                Add New Product
                            </h2>
                            <p className="text-[13px] text-slate-500">
                                Fill in the details below to add a product to your catalog
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => !saving && onClose()}
                        disabled={saving}
                        aria-label="Close"
                        className="h-8 w-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors disabled:opacity-50"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-3">
                    {error && (
                        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-[13px] flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        {/* LEFT: form */}
                        <div className="lg:col-span-2 space-y-3">
                            <Field
                                label="Product name *"
                                value={form.name}
                                onChange={(v) => setForm({ ...form, name: v })}
                                placeholder="e.g. Apex Ultra X1 Pro 5G"
                            />

                            {/* Category + Brand — floating dropdowns */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <FloatingSelect
                                    label="Category *"
                                    value={form.category}
                                    options={categoryOptions}
                                    loading={loadingOptions}
                                    disabled={saving}
                                    onChange={(v) => setForm({ ...form, category: v })}
                                    placeholder="Select a category"
                                />
                                <FloatingSelect
                                    label="Brand *"
                                    value={form.brand}
                                    options={brandOptions}
                                    loading={loadingOptions}
                                    disabled={saving}
                                    onChange={(v) => setForm({ ...form, brand: v })}
                                    placeholder="Select a brand"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field
                                    label="List price (KES) *"
                                    value={form.price}
                                    onChange={(v) => setForm({ ...form, price: v })}
                                    placeholder="89900"
                                    type="number"
                                    hint="What customers see before discount"
                                />
                                <Field
                                    label="Sale price (optional)"
                                    value={form.salePrice}
                                    onChange={(v) => setForm({ ...form, salePrice: v })}
                                    placeholder="79900"
                                    type="number"
                                    hint="The actual price paid if discounted"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field
                                    label="Stock quantity *"
                                    value={form.stock}
                                    onChange={(v) => setForm({ ...form, stock: v })}
                                    placeholder="10"
                                    type="number"
                                />
                                <Field
                                    label="Low-stock threshold"
                                    value={form.lowStockThreshold}
                                    onChange={(v) =>
                                        setForm({ ...form, lowStockThreshold: v })
                                    }
                                    placeholder="10"
                                    type="number"
                                    hint="Warn when stock drops below this"
                                />
                            </div>

                            <Field
                                label="SKU (optional)"
                                value={form.sku}
                                onChange={(v) => setForm({ ...form, sku: v })}
                                placeholder="APX-X1-5G"
                                hint="Not yet persisted — SKU support comes later"
                            />

                            <div>
                                <label className="block text-[13px] font-medium text-slate-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    rows={3}
                                    maxLength={400}
                                    value={form.shortDescription}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            shortDescription: e.target.value,
                                        })
                                    }
                                    placeholder="A short summary that appears on product cards and the detail page."
                                    className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-[13px] text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                                />
                                <p className="text-[11px] text-slate-400 text-right mt-0.5">
                                    {form.shortDescription.length}/400
                                </p>
                            </div>

                            <div>
                                <div className="flex items-baseline justify-between mb-1">
                                    <label className="text-[13px] font-medium text-slate-700">
                                        Product images
                                    </label>
                                    <span className="text-[13px] text-slate-400">
                                        {form.images.length} of {MAX_IMAGES}
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    {form.images.map((img, idx) => (
                                        <div
                                            key={idx}
                                            className="relative aspect-square rounded-md overflow-hidden border border-slate-200 bg-white"
                                        >
                                            <img
                                                src={img}
                                                alt={`Image ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                            {idx === 0 && (
                                                <span className="absolute bottom-1 left-1 text-[11px] font-semibold bg-blue-950 text-white px-2 py-0.5 rounded">
                                                    Primary
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => removeImage(idx)}
                                                disabled={saving}
                                                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white border border-slate-200 hover:bg-red-50 flex items-center justify-center disabled:opacity-50"
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
                                            className="aspect-square rounded-md border border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
                                        >
                                            <input
                                                ref={idx === 0 ? fileInputRef : undefined}
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                className="hidden"
                                                onChange={(e) => addImages(e.target.files)}
                                                disabled={saving}
                                            />
                                            <ImageIcon className="h-5 w-5 text-slate-400" />
                                            <span className="text-[13px] text-slate-500 mt-1">
                                                {idx === 0 && form.images.length === 0
                                                    ? "Add image"
                                                    : "Add"}
                                            </span>
                                        </label>
                                    ))}
                                </div>

                                <p className="text-[11px] text-slate-500 mt-2">
                                    Up to {MAX_IMAGES} images · max {MAX_FILE_MB}MB each ·
                                    first image becomes the primary thumbnail
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[13px] font-medium text-slate-700 mb-1">
                                        Status
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setForm({ ...form, status: "published" })
                                            }
                                            disabled={saving}
                                            className={`px-3 py-2 rounded-md text-[13px] font-medium border transition-colors ${form.status === "published"
                                                    ? "bg-blue-950 text-white border-blue-950"
                                                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                                }`}
                                        >
                                            Published
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setForm({ ...form, status: "draft" })
                                            }
                                            disabled={saving}
                                            className={`px-3 py-2 rounded-md text-[13px] font-medium border transition-colors ${form.status === "draft"
                                                    ? "bg-blue-950 text-white border-blue-950"
                                                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                                }`}
                                        >
                                            Draft
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium text-slate-700 mb-1">
                                        Storefront
                                    </label>
                                    <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-md cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={form.featured}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    featured: e.target.checked,
                                                })
                                            }
                                            disabled={saving}
                                            className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950"
                                        />
                                        <span className="text-[13px] text-slate-700">
                                            Feature on homepage
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: preview */}
                        <div className="lg:col-span-1">
                            <p className="text-[13px] font-medium text-slate-700 mb-1">
                                Live preview
                            </p>
                            <div className="bg-white border border-slate-200 rounded-md overflow-hidden sticky top-0">
                                <div className="aspect-square bg-white border-b border-slate-200 flex items-center justify-center overflow-hidden relative">
                                    {form.images[0] ? (
                                        <img
                                            src={form.images[0]}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <Package className="h-10 w-10 text-slate-300" />
                                    )}
                                </div>

                                {form.images.length > 1 && (
                                    <div className="flex gap-1 p-2 border-b border-slate-100">
                                        {form.images.slice(1).map((img, i) => (
                                            <div
                                                key={i}
                                                className="w-8 h-8 rounded overflow-hidden border border-slate-200"
                                            >
                                                <img
                                                    src={img}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="p-2 space-y-1">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                                        {form.brand || "Brand"}
                                    </p>
                                    <p className="text-[13px] font-semibold text-slate-900 line-clamp-2">
                                        {form.name || "Product name"}
                                    </p>
                                    <div className="flex items-baseline gap-1.5 pt-1">
                                        <span className="text-[13px] font-bold text-slate-900">
                                            KES{" "}
                                            {form.salePrice
                                                ? Number(form.salePrice).toLocaleString()
                                                : form.price
                                                    ? Number(form.price).toLocaleString()
                                                    : "0"}
                                        </span>
                                        {form.salePrice && form.price && (
                                            <span className="text-[13px] text-slate-400 line-through">
                                                KES {Number(form.price).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                    <span
                                        className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded mt-1 ${form.status === "published"
                                                ? "bg-emerald-50 text-emerald-700"
                                                : "bg-amber-50 text-amber-700"
                                            }`}
                                    >
                                        {form.status === "published"
                                            ? "Published"
                                            : "Draft"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-slate-200 shrink-0 bg-white">
                    <p className="text-[13px] text-slate-500 hidden sm:block">
                        Fields marked with * are required
                    </p>
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-md text-[13px] transition-colors disabled:opacity-60"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={!canSave || saving}
                            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-md text-[13px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Saving…
                                </>
                            ) : (
                                <>
                                    <Plus className="h-3.5 w-3.5" />
                                    Save product
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Compact field ─── */
function Field({
    label,
    value,
    onChange,
    type = "text",
    placeholder,
    hint,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    placeholder?: string;
    hint?: string;
}) {
    return (
        <label className="block">
            <span className="block text-[13px] font-medium text-slate-700 mb-1">
                {label}
            </span>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
            {hint && (
                <p className="text-[11px] text-slate-400 mt-1">{hint}</p>
            )}
        </label>
    );
}

/* ─── Floating select ──────────────────────────────────────────────
 * Renders the dropdown at document.body via createPortal, so it floats
 * above any parent with overflow / transform / z-index constraints.
 *
 * - Auto-flips above the trigger if there isn't room below.
 * - Matches the trigger's width.
 * - Closes on outside click, ESC, or selecting an item.
 * - Repositions on window resize.
 */
function FloatingSelect({
    label,
    value,
    options,
    onChange,
    placeholder = "Select…",
    loading = false,
    disabled = false,
    searchable = true,
}: {
    label?: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
    placeholder?: string;
    loading?: boolean;
    disabled?: boolean;
    searchable?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [coords, setCoords] = useState<{
        top: number;
        left: number;
        width: number;
        flipAbove: boolean;
    } | null>(null);

    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const searchRef = useRef<HTMLInputElement | null>(null);

    const selected = options.find((o) => o.value === value);

    // Compute position when opening
    useLayoutEffect(() => {
        if (!open || !triggerRef.current) return;

        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const estimatedHeight = 260;
        const flipAbove = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

        setCoords({
            top: flipAbove ? rect.top - 4 : rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            flipAbove,
        });
    }, [open]);

    // Recompute on resize
    useEffect(() => {
        if (!open) return;
        const onResize = () => {
            if (!triggerRef.current) return;
            const rect = triggerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const estimatedHeight = 260;
            const flipAbove =
                spaceBelow < estimatedHeight && rect.top > estimatedHeight;
            setCoords({
                top: flipAbove ? rect.top - 4 : rect.bottom + 4,
                left: rect.left,
                width: rect.width,
                flipAbove,
            });
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [open]);

    // Outside click + ESC
    useEffect(() => {
        if (!open) return;

        const onDoc = (e: MouseEvent) => {
            const t = e.target as Node;
            if (
                triggerRef.current?.contains(t) ||
                dropdownRef.current?.contains(t)
            ) {
                return;
            }
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey, true);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            document.removeEventListener("keydown", onKey, true);
        };
    }, [open]);

    // Reset search + focus the search input when opening
    useEffect(() => {
        if (open) {
            setQuery("");
            requestAnimationFrame(() => searchRef.current?.focus());
        }
    }, [open]);

    const filtered = query
        ? options.filter((o) =>
            o.label.toLowerCase().includes(query.toLowerCase()),
        )
        : options;

    const handleSelect = (v: string) => {
        onChange(v);
        setOpen(false);
    };

    return (
        <div>
            {label && (
                <label className="block text-[13px] font-medium text-slate-700 mb-1">
                    {label}
                </label>
            )}

            <button
                ref={triggerRef}
                type="button"
                onClick={() => !disabled && !loading && setOpen((v) => !v)}
                disabled={disabled || loading}
                className={`w-full flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-md px-3 py-2 text-[13px] text-left transition-colors focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60 ${open ? "border-blue-950 ring-1 ring-blue-950" : ""
                    }`}
            >
                <span
                    className={
                        selected ? "text-slate-900 truncate" : "text-slate-400 truncate"
                    }
                >
                    {loading
                        ? "Loading…"
                        : selected
                            ? selected.label
                            : placeholder}
                </span>
                <ChevronDown
                    className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""
                        }`}
                />
            </button>

            {open &&
                coords &&
                createPortal(
                    <div
                        ref={dropdownRef}
                        style={{
                            position: "fixed",
                            top: coords.flipAbove ? undefined : coords.top,
                            bottom: coords.flipAbove
                                ? window.innerHeight - coords.top
                                : undefined,
                            left: coords.left,
                            width: coords.width,
                            zIndex: 9999,
                        }}
                        className="bg-white border border-slate-200 rounded-md shadow-xl overflow-hidden flex flex-col"
                    >
                        {searchable && options.length > 6 && (
                            <div className="relative border-b border-slate-100 shrink-0">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    ref={searchRef}
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search…"
                                    className="w-full bg-white pl-9 pr-3 py-2 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none"
                                />
                            </div>
                        )}

                        <div className="overflow-y-auto max-h-60 py-1">
                            {filtered.length === 0 ? (
                                <p className="px-3 py-2 text-[13px] text-slate-400">
                                    No matches
                                </p>
                            ) : (
                                filtered.map((opt) => {
                                    const isSelected = opt.value === value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => handleSelect(opt.value)}
                                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] text-left transition-colors ${isSelected
                                                    ? "bg-blue-50 text-blue-950 font-medium"
                                                    : "text-slate-700 hover:bg-slate-50"
                                                }`}
                                        >
                                            <span className="truncate">
                                                {opt.label}
                                            </span>
                                            {isSelected && (
                                                <Check className="w-3.5 h-3.5 shrink-0" />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>,
                    document.body,
                )}
        </div>
    );
}