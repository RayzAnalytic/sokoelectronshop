"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Upload, Plus, Image as ImageIcon, Package } from "lucide-react";

type Props = {
    open: boolean;
    onClose: () => void;
    onSave?: (data: any) => void;
};

const CATEGORIES = ["Smartphones", "Laptops", "Audio", "Accessories", "TVs", "Gaming", "Cameras", "Networking"];
const BRANDS = ["Apex", "Zenith", "SonicWave", "Vizion", "Nexus", "Pulse", "Quantum", "Aero", "Samsung", "HP", "Apple", "Sony", "JBL", "TP-Link", "Xiaomi", "Other"];

const MAX_IMAGES = 3;

const EMPTY = {
    name: "",
    category: "Smartphones",
    brand: "Apex",
    price: "",
    salePrice: "",
    stock: "",
    sku: "",
    shortDescription: "",
    status: "published" as "published" | "draft",
    images: [] as string[],
};

export default function AddProductModal({ open, onClose, onSave }: Props) {
    const [form, setForm] = useState(EMPTY);

    // Lock body scroll while open
    useEffect(() => {
        if (!open) return;
        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = original;
        };
    }, [open]);

    // Close on ESC
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // Reset form each time it opens
    useEffect(() => {
        if (open) setForm(EMPTY);
    }, [open]);

    if (!open) return null;

    const addImages = (files: FileList | null) => {
        if (!files) return;
        const remaining = MAX_IMAGES - form.images.length;
        const incoming = Array.from(files).slice(0, remaining);
        const urls = incoming.map((f) => URL.createObjectURL(f));
        setForm({ ...form, images: [...form.images, ...urls] });
    };

    const removeImage = (idx: number) =>
        setForm({ ...form, images: form.images.filter((_, i) => i !== idx) });

    const handleSave = () => {
        if (!form.name.trim() || !form.price || !form.stock) return;
        onSave?.(form);
        onClose();
    };

    const canSave = form.name.trim() && form.price && form.stock;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
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
                            <h2 className="text-[13px] font-semibold text-slate-900">Add New Product</h2>
                            <p className="text-[13px] text-slate-500">Fill in the details below to add a product to your catalog</p>
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

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-3">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

                        {/* LEFT: form */}
                        <div className="lg:col-span-2 space-y-3">

                            {/* Name */}
                            <Field
                                label="Product name"
                                value={form.name}
                                onChange={(v) => setForm({ ...form, name: v })}
                                placeholder="e.g. Apex Ultra X1 Pro 5G"
                            />

                            {/* Category + Brand */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[13px] font-medium text-slate-700 mb-1">Category</label>
                                    <select
                                        value={form.category}
                                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-950"
                                    >
                                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium text-slate-700 mb-1">Brand</label>
                                    <select
                                        value={form.brand}
                                        onChange={(e) => setForm({ ...form, brand: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-950"
                                    >
                                        {BRANDS.map((b) => <option key={b}>{b}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Price + Sale price */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field
                                    label="Price (KES)"
                                    value={form.price}
                                    onChange={(v) => setForm({ ...form, price: v })}
                                    placeholder="89900"
                                    type="number"
                                />
                                <Field
                                    label="Sale price (optional)"
                                    value={form.salePrice}
                                    onChange={(v) => setForm({ ...form, salePrice: v })}
                                    placeholder="79900"
                                    type="number"
                                />
                            </div>

                            {/* Stock + SKU */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field
                                    label="Stock quantity"
                                    value={form.stock}
                                    onChange={(v) => setForm({ ...form, stock: v })}
                                    placeholder="10"
                                    type="number"
                                />
                                <Field
                                    label="SKU (auto-generated if empty)"
                                    value={form.sku}
                                    onChange={(v) => setForm({ ...form, sku: v })}
                                    placeholder="APX-X1-5G"
                                />
                            </div>

                            {/* Short description */}
                            <div>
                                <label className="block text-[13px] font-medium text-slate-700 mb-1">
                                    Short description
                                </label>
                                <textarea
                                    rows={3}
                                    maxLength={160}
                                    value={form.shortDescription}
                                    onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                                    placeholder="A short one-line summary that appears on product cards."
                                    className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-[13px] text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                                />
                                <p className="text-[13px] text-slate-400 text-right mt-0.5">
                                    {form.shortDescription.length}/160
                                </p>
                            </div>

                            {/* 3 IMAGE UPLOAD */}
                            <div>
                                <div className="flex items-baseline justify-between mb-1">
                                    <label className="text-[13px] font-medium text-slate-700">Product images</label>
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
                                            <img src={img} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
                                            {idx === 0 && (
                                                <span className="absolute bottom-1 left-1 text-[13px] font-semibold bg-blue-950 text-white px-2 py-0.5 rounded">
                                                    Primary
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => removeImage(idx)}
                                                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white border border-slate-200 hover:bg-red-50 flex items-center justify-center"
                                                aria-label="Remove image"
                                            >
                                                <X className="h-3 w-3 text-red-600" />
                                            </button>
                                        </div>
                                    ))}

                                    {Array.from({ length: MAX_IMAGES - form.images.length }).map((_, idx) => (
                                        <label
                                            key={`slot-${idx}`}
                                            className="aspect-square rounded-md border border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
                                        >
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                className="hidden"
                                                onChange={(e) => addImages(e.target.files)}
                                            />
                                            <ImageIcon className="h-5 w-5 text-slate-400" />
                                            <span className="text-[13px] text-slate-500 mt-1">
                                                {idx === 0 && form.images.length === 0 ? "Add image" : "Add"}
                                            </span>
                                        </label>
                                    ))}
                                </div>

                                <p className="text-[13px] text-slate-500 mt-2">
                                    Up to 3 images · First image becomes the primary thumbnail
                                </p>
                            </div>

                            {/* Status */}
                            <div>
                                <label className="block text-[13px] font-medium text-slate-700 mb-1">Status</label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, status: "published" })}
                                        className={`px-3 py-2 rounded-md text-[13px] font-medium border transition-colors ${
                                            form.status === "published"
                                                ? "bg-blue-950 text-white border-blue-950"
                                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                        }`}
                                    >
                                        Published
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, status: "draft" })}
                                        className={`px-3 py-2 rounded-md text-[13px] font-medium border transition-colors ${
                                            form.status === "draft"
                                                ? "bg-blue-950 text-white border-blue-950"
                                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                        }`}
                                    >
                                        Draft
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: preview */}
                        <div className="lg:col-span-1">
                            <p className="text-[13px] font-medium text-slate-700 mb-1">Live preview</p>
                            <div className="bg-white border border-slate-200 rounded-md overflow-hidden sticky top-0">
                                <div className="aspect-square bg-white border-b border-slate-200 flex items-center justify-center overflow-hidden relative">
                                    {form.images[0] ? (
                                        <img src={form.images[0]} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <Package className="h-10 w-10 text-slate-300" />
                                    )}
                                </div>

                                {form.images.length > 1 && (
                                    <div className="flex gap-1 p-2 border-b border-slate-100">
                                        {form.images.map((img, i) => (
                                            <div key={i} className="w-8 h-8 rounded overflow-hidden border border-slate-200">
                                                <img src={img} alt="" className="w-full h-full object-cover" />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="p-2 space-y-1">
                                    <p className="text-[13px] uppercase tracking-wide text-slate-500">{form.brand}</p>
                                    <p className="text-[13px] font-semibold text-slate-900 line-clamp-2">
                                        {form.name || "Product name"}
                                    </p>
                                    <div className="flex items-baseline gap-1.5 pt-1">
                                        <span className="text-[13px] font-bold text-slate-900">
                                            KES {form.price ? Number(form.price).toLocaleString() : "0"}
                                        </span>
                                        {form.salePrice && (
                                            <span className="text-[13px] text-slate-400 line-through">
                                                KES {Number(form.salePrice).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                    <span
                                        className={`inline-block text-[13px] font-medium px-2 py-0.5 rounded mt-1 ${
                                            form.status === "published"
                                                ? "bg-emerald-50 text-emerald-700"
                                                : "bg-amber-50 text-amber-700"
                                        }`}
                                    >
                                        {form.status === "published" ? "Published" : "Draft"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-slate-200 shrink-0 bg-white">
                    <p className="text-[13px] text-slate-500 hidden sm:block">
                        All fields marked with * are required
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
                            onClick={handleSave}
                            disabled={!canSave}
                            className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-md text-[13px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Save product
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
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    placeholder?: string;
}) {
    return (
        <label className="block">
            <span className="block text-[13px] font-medium text-slate-700 mb-1">{label}</span>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
        </label>
    );
}