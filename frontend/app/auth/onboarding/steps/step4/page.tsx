// app/onboarding/steps/step4/page.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Plus,
  Upload,
  X,
  Check,
  Image as ImageIcon,
  Trash2,
  FileSpreadsheet,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description?: string;
  image?: string;
}

const EMPTY = { name: '', description: '', image: '' };

export default function Step4CategoryPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [csvName, setCsvName] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleSaveCategory = (c: Omit<Category, 'id'>) => {
    setCategories((prev) => [
      ...prev,
      { id: crypto.randomUUID(), ...c },
    ]);
  };

  const handleRemove = (id: string) =>
    setCategories((prev) => prev.filter((c) => c.id !== id));

  const handleCsvFile = (file?: File) => {
    if (!file) return;
    setCsvName(file.name);
  };

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <header className="text-center max-w-lg mx-auto space-y-2 pt-4">
        <span className="w-12 h-12 rounded-full bg-blue-50 text-blue-950 border border-blue-100 flex items-center justify-center mx-auto">
          <Sparkles className="h-6 w-6" />
        </span>
        <h2 className="text-[18px] font-semibold text-slate-900">
          Create your categories
        </h2>
        <p className="text-[13px] text-slate-500">
          Add categories one by one, or upload a CSV to import them in bulk.
        </p>
      </header>

      {/* Add category card */}
      <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-slate-700">
            Categories
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-1.5 rounded-sm text-[12px] transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Category
          </button>
        </div>

        {categories.length === 0 ? (
          <p className="text-[12px] text-slate-400 py-2">
            No categories yet. Add one to get started.
          </p>
        ) : (
          <ul className="bg-white border border-slate-200 rounded-sm divide-y divide-slate-100">
            {categories.map((c) => (
              <li
                key={c.id}
                className="px-3 py-2 flex items-center justify-between gap-2 text-[13px]"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-sm bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    {c.image ? (
                      <img
                        src={c.image}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5 text-slate-400" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-900 truncate">
                      {c.name}
                    </span>
                    {c.description && (
                      <span className="block text-[11px] text-slate-500 truncate">
                        {c.description}
                      </span>
                    )}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(c.id)}
                  className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm transition shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* CSV upload card */}
      <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-4 space-y-3">
        <div>
          <p className="text-[12px] font-medium text-slate-700">
            Bulk import (CSV)
          </p>
          <p className="text-[11px] text-slate-500">
            Upload a CSV with columns: name, description, image_url
          </p>
        </div>

        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleCsvFile(e.dataTransfer.files?.[0]);
          }}
          className="block border-2 border-dashed border-slate-300 hover:border-blue-950/40 hover:bg-blue-50/20 rounded-sm p-5 text-center cursor-pointer transition"
        >
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleCsvFile(e.target.files?.[0])}
          />
          <FileSpreadsheet className="w-7 h-7 mx-auto text-slate-400" />
          <p className="text-[13px] font-medium text-slate-900 mt-2">
            Drop a CSV file or click to browse
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Max 5MB · .csv only
          </p>
        </label>

        {csvName && (
          <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px]">
            <span className="flex items-center gap-2 min-w-0">
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span className="truncate font-medium text-slate-900">
                {csvName}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setCsvName(null)}
              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm transition shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="max-w-lg mx-auto flex items-center gap-2 pt-2">
        <Link
          href="/onboarding/steps/step3"
          className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium px-4 py-2.5 rounded-sm text-[13px] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        <Link
          href="/onboarding/steps/step5"
          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2.5 rounded-sm text-[13px] transition"
        >
          Continue
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Add Category Modal */}
      <AddCategoryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={(c) => handleSaveCategory(c)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add Category Modal                                                  */
/* ------------------------------------------------------------------ */
function AddCategoryModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (c: Omit<Category, 'id'>) => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(EMPTY);
  }, [open]);

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

  if (!open) return null;

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    setIsSaving(true);
    setTimeout(() => {
      onSave({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        image: form.image || undefined,
      });
      setIsSaving(false);
      onClose();
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="bg-white border border-slate-200 rounded-sm max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 shrink-0">
          <h2 className="text-[15px] font-semibold text-slate-900">
            Add Category
          </h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
          {/* Name */}
          <label className="block">
            <span className="block font-medium text-slate-700 mb-1">
              Category name *
            </span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Smart Home & IoT"
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
            />
          </label>

          {/* Description */}
          <label className="block">
            <span className="block font-medium text-slate-700 mb-1">
              Description{' '}
              <span className="text-slate-400 font-normal">(optional)</span>
            </span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Brief category summary for the storefront…"
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
            />
          </label>

          {/* Image */}
          <div>
            <span className="block font-medium text-slate-700 mb-1">
              Image{' '}
              <span className="text-slate-400 font-normal">(optional)</span>
            </span>
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 rounded-sm bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                {form.image ? (
                  <img
                    src={form.image}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  {form.image ? 'Change image' : 'Upload image'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setForm({
                        ...form,
                        image: URL.createObjectURL(file),
                      });
                    }}
                  />
                </label>
                {form.image && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, image: '' })}
                    className="inline-flex items-center gap-1.5 text-rose-600 hover:underline text-[13px] font-medium px-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove image
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Square image, min 500×500px recommended.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.name.trim() || isSaving}
            className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            {isSaving ? 'Saving…' : 'Save category'}
          </button>
        </div>
      </div>
    </div>
  );
}