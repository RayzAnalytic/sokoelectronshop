'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  X, Upload, Check, Image as ImageIcon, Trash2, Link as LinkIcon,
  Loader2, AlertCircle,
} from 'lucide-react';

type CategoryStatus = 'Active' | 'Inactive';

interface Category {
  id?: string;
  name: string;
  slug: string;
  parentId: string | null;
  description?: string;
  image: string;
  status: CategoryStatus;
  displayOrder: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (category: Omit<Category, 'id'> & { id?: string }) => Promise<void> | void;
  initial?: Category | null;
  parentOptions: { id: string; name: string }[];
}

const EMPTY = {
  name: '',
  slug: '',
  parentId: '',
  description: '',
  image: '',
  status: 'Active' as CategoryStatus,
  displayOrder: '1',
};

const MAX_FILE_MB = 2;

/** File → base64 data URL. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function AddCategoryModal({
  open,
  onClose,
  onSave,
  initial,
  parentOptions,
}: Props) {
  const [form, setForm] = useState(EMPTY);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Populate / reset when the modal opens
  useEffect(() => {
    if (!open) return;
    setError('');

    if (initial) {
      setForm({
        name: initial.name,
        slug: initial.slug,
        parentId: initial.parentId ?? '',
        description: initial.description ?? '',
        image: initial.image ?? '',
        status: initial.status,
        displayOrder: String(initial.displayOrder),
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, initial]);

  // Auto-slug from name — but only when the user hasn't manually typed one.
  useEffect(() => {
    if (!form.name) return;
    const slug = form.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setForm((prev) => ({ ...prev, slug }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name]);

  // ESC + body lock
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isSaving) return;
      if (imagePickerOpen) setImagePickerOpen(false);
      else onClose();
    };

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, imagePickerOpen, onClose, isSaving]);

  if (!open) return null;

  const canSave =
    form.name.trim().length > 0 &&
    form.slug.trim().length > 0 &&
    !isSaving;

  const handleSubmit = async () => {
    if (!canSave) return;

    setIsSaving(true);
    setError('');

    try {
      await onSave({
        id: initial?.id,
        name: form.name.trim(),
        slug: form.slug.trim() || 'category',
        parentId: form.parentId || null,
        description: form.description.trim(),
        image: form.image || '/placeholder.jpeg',
        status: form.status,
        displayOrder: Number(form.displayOrder) || 1,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save the category.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const closeIfIdle = () => {
    if (isSaving) return;
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
        onClick={closeIfIdle}
      >
        <div
          className="bg-white border border-slate-200 rounded-sm max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 shrink-0">
            <h2 className="text-[15px] font-semibold text-slate-900">
              {initial ? 'Edit Category' : 'Add Category'}
            </h2>
            <button
              type="button"
              onClick={closeIfIdle}
              disabled={isSaving}
              className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 disabled:opacity-50"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
            {/* Error banner */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-sm text-[13px] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Field
              label="Category name *"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="e.g. Smart Home & IoT"
            />

            <Field
              label="Slug (auto-generated)"
              value={form.slug}
              onChange={(v) => setForm({ ...form, slug: v })}
              mono
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Parent category
                </label>
                <select
                  value={form.parentId}
                  onChange={(e) =>
                    setForm({ ...form, parentId: e.target.value })
                  }
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                >
                  <option value="">None (Root)</option>
                  {parentOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                label="Display order"
                type="number"
                value={form.displayOrder}
                onChange={(v) => setForm({ ...form, displayOrder: v })}
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Brief category summary for the storefront…"
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

            {/* Image upload */}
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Category image
              </label>
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
                  <button
                    type="button"
                    onClick={() => setImagePickerOpen(true)}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-60"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {form.image ? 'Change image' : 'Upload image'}
                  </button>
                  {form.image && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, image: '' })}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 text-red-600 hover:underline text-[13px] font-medium px-1 disabled:opacity-60"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove image
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[13px] text-slate-400 mt-1">
                Square image, min 500×500px recommended.
              </p>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="font-medium text-slate-700">Status</span>
              <div className="inline-flex bg-slate-100 p-0.5 rounded-sm">
                {(['Active', 'Inactive'] as CategoryStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm({ ...form, status: s })}
                    disabled={isSaving}
                    className={`px-3 py-1.5 rounded-sm text-[13px] font-medium transition ${form.status === s
                        ? s === 'Active'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-700 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={closeIfIdle}
              disabled={isSaving}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSave}
              className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  {initial ? 'Save changes' : 'Save category'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Image picker */}
      {imagePickerOpen && (
        <ImagePickerModal
          onClose={() => setImagePickerOpen(false)}
          onSelect={(url) => {
            setForm({ ...form, image: url });
            setImagePickerOpen(false);
          }}
        />
      )}
    </>
  );
}

/* ─────────── Image picker ─────────── */
function ImagePickerModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>('');
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleFile = async (file?: File) => {
    if (!file) return;
    setLocalError('');

    if (!file.type.startsWith('image/')) {
      setLocalError('That file is not an image.');
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setLocalError(`Image is over ${MAX_FILE_MB}MB.`);
      return;
    }

    setUploading(true);
    try {
      // Convert to base64 data URL — survives a page reload and reaches
      // the backend (unlike blob: URLs, which are scoped to this tab).
      const dataUrl = await fileToDataUrl(file);
      setPreview(dataUrl);
    } catch {
      setLocalError('Could not read that file.');
    } finally {
      setUploading(false);
    }
  };

  const urlIsUsable = (() => {
    const v = url.trim();
    if (!v) return false;
    if (v.startsWith('/')) return true; // app-relative path like /tvs.jpeg
    try {
      const u = new URL(v);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  })();

  const selected = preview || (mode === 'url' && urlIsUsable ? url : '');

  return (
    <div
      className="fixed inset-0 z-[110] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-sm max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
          <h3 className="text-[15px] font-semibold text-slate-900">
            Choose image
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 p-2 bg-slate-50 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-sm text-[13px] font-medium transition ${mode === 'upload'
                ? 'bg-white text-blue-950 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-sm text-[13px] font-medium transition ${mode === 'url'
                ? 'bg-white text-blue-950 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            From URL
          </button>
        </div>

        <div className="p-3 space-y-3">
          {mode === 'upload' ? (
            <label
              className="block border-2 border-dashed border-slate-300 hover:border-blue-950 hover:bg-blue-50/20 rounded-sm p-6 text-center cursor-pointer transition"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files?.[0]);
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {uploading ? (
                <>
                  <Loader2 className="w-7 h-7 mx-auto text-slate-400 animate-spin" />
                  <p className="text-[13px] font-medium text-slate-900 mt-2">
                    Reading…
                  </p>
                </>
              ) : (
                <>
                  <Upload className="w-7 h-7 mx-auto text-slate-400" />
                  <p className="text-[13px] font-medium text-slate-900 mt-2">
                    Drop an image or click to browse
                  </p>
                  <p className="text-[13px] text-slate-500 mt-0.5">
                    PNG, JPG, WEBP · max {MAX_FILE_MB}MB
                  </p>
                </>
              )}
            </label>
          ) : (
            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1">
                Image URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Must start with <code>/</code>, <code>http://</code>, or{' '}
                <code>https://</code>.
              </p>
            </div>
          )}

          {localError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-sm text-[13px] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{localError}</span>
            </div>
          )}

          {/* Preview */}
          {selected && (
            <div className="border border-slate-200 rounded-sm p-2">
              <p className="text-[13px] font-medium text-slate-500 mb-1">
                Preview
              </p>
              <div className="aspect-square max-w-[180px] mx-auto rounded-sm overflow-hidden bg-slate-50 border border-slate-200">
                <img
                  src={selected}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = '0.3';
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => selected && onSelect(selected)}
            disabled={!selected || uploading}
            className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            Use image
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Field ─────────── */
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="block font-medium text-slate-700 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 ${mono ? 'font-mono text-slate-600' : 'text-slate-900'
          }`}
      />
    </label>
  );
}