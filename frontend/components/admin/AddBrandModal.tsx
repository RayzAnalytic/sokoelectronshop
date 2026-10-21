'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  X, Upload, Check, Image as ImageIcon, Trash2, Link as LinkIcon,
  Loader2, AlertCircle,
} from 'lucide-react';

type BrandStatus = 'Active' | 'Inactive';

interface Brand {
  id?: string;
  name: string;
  slug: string;
  logo: string;
  status: BrandStatus;
  description?: string;
  websiteUrl?: string;
  featured?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (
    brand: Omit<Brand, 'id'> & { id?: string },
  ) => Promise<void> | void;
  initial?: Brand | null;
}

const MAX_FILE_MB = 2;

const EMPTY = {
  name: '',
  slug: '',
  logo: '',
  description: '',
  websiteUrl: '',
  status: 'Active' as BrandStatus,
  featured: false,
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function AddBrandModal({
  open,
  onClose,
  onSave,
  initial,
}: Props) {
  const [form, setForm] = useState(EMPTY);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');

    if (initial) {
      setForm({
        name: initial.name,
        slug: initial.slug,
        logo: initial.logo ?? '',
        description: initial.description ?? '',
        websiteUrl: initial.websiteUrl ?? '',
        status: initial.status,
        featured: initial.featured ?? false,
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!form.name) return;
    const slug = form.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setForm((prev) => ({ ...prev, slug }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isSaving) return;
      if (imagePickerOpen) setImagePickerOpen(false);
      else onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, imagePickerOpen, onClose, isSaving]);

  if (!open) return null;

  const canSave = form.name.trim().length > 0 && !isSaving;

  const closeIfIdle = () => {
    if (isSaving) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setError('');

    try {
      await onSave({
        id: initial?.id,
        name: form.name.trim(),
        slug: form.slug.trim() || 'brand',
        logo: form.logo || '',
        description: form.description.trim(),
        websiteUrl: form.websiteUrl.trim(),
        status: form.status,
        featured: form.featured,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save the brand.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
        onClick={closeIfIdle}
      >
        <div
          className="bg-white border border-slate-200 rounded-md max-w-md w-full max-h-[90vh] flex flex-col shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 shrink-0">
            <h2 className="text-[13px] font-semibold text-slate-900">
              {initial ? 'Edit brand' : 'Add brand'}
            </h2>
            <button
              type="button"
              onClick={closeIfIdle}
              disabled={isSaving}
              className="h-7 w-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 disabled:opacity-50"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-[12px]">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-2.5 py-2 rounded-md flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Field
              label="Brand name *"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="e.g. Microsoft"
            />

            <Field
              label="Slug (auto-generated)"
              value={form.slug}
              onChange={(v) => setForm({ ...form, slug: v })}
              mono
            />

            <Field
              label="Website URL"
              type="url"
              value={form.websiteUrl}
              onChange={(v) => setForm({ ...form, websiteUrl: v })}
              placeholder="https://example.com"
            />

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
                placeholder="Brief overview of the brand and its catalog…"
                className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-[12px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Brand logo
              </label>
              <div className="flex items-center gap-2.5">
                <div className="w-14 h-14 rounded-md bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {form.logo ? (
                    <img
                      src={form.logo}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setImagePickerOpen(true)}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-1.5 rounded-md text-[12px] disabled:opacity-60"
                  >
                    <Upload className="w-3 h-3" />
                    {form.logo ? 'Change logo' : 'Upload logo'}
                  </button>
                  {form.logo && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, logo: '' })}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1 text-red-600 hover:underline text-[11px] font-medium px-0.5 disabled:opacity-60"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove logo
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Square image, min 300×300px recommended. Max {MAX_FILE_MB}MB.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
              <div>
                <label className="block font-medium text-slate-700 mb-1 text-[12px]">
                  Status
                </label>
                <div className="inline-flex bg-slate-100 p-0.5 rounded-md">
                  {(['Active', 'Inactive'] as BrandStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm({ ...form, status: s })}
                      disabled={isSaving}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                        form.status === s
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
              <div>
                <label className="block font-medium text-slate-700 mb-1 text-[12px]">
                  Storefront
                </label>
                <label className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-slate-200 rounded-md cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) =>
                      setForm({ ...form, featured: e.target.checked })
                    }
                    disabled={isSaving}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-950 focus:ring-blue-950"
                  />
                  <span className="text-slate-700 text-[12px]">Feature</span>
                </label>
              </div>
            </div>
          </div>

          <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-1.5 shrink-0">
            <button
              type="button"
              onClick={closeIfIdle}
              disabled={isSaving}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-1.5 rounded-md text-[12px] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSave}
              className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded-md text-[12px] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check className="w-3 h-3" />
                  {initial ? 'Save changes' : 'Save brand'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {imagePickerOpen && (
        <ImagePickerModal
          onClose={() => setImagePickerOpen(false)}
          onSelect={(url) => {
            setForm({ ...form, logo: url });
            setImagePickerOpen(false);
          }}
        />
      )}
    </>
  );
}

function ImagePickerModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
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
    if (v.startsWith('/')) return true;
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
        className="bg-white border border-slate-200 rounded-md max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
          <h3 className="text-[13px] font-semibold text-slate-900">
            Choose logo
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1 p-2 bg-slate-50 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-md text-[12px] font-medium transition ${
              mode === 'upload'
                ? 'bg-white text-blue-950 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Upload className="w-3 h-3" />
            Upload
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-md text-[12px] font-medium transition ${
              mode === 'url'
                ? 'bg-white text-blue-950 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <LinkIcon className="w-3 h-3" />
            From URL
          </button>
        </div>

        <div className="p-3 space-y-2.5">
          {mode === 'upload' ? (
            <label
              className="block border-2 border-dashed border-slate-300 hover:border-blue-950 hover:bg-blue-50/20 rounded-md p-5 text-center cursor-pointer transition"
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
                  <Loader2 className="w-6 h-6 mx-auto text-slate-400 animate-spin" />
                  <p className="text-[12px] font-medium text-slate-900 mt-1.5">
                    Reading…
                  </p>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6 mx-auto text-slate-400" />
                  <p className="text-[12px] font-medium text-slate-900 mt-1.5">
                    Drop an image or click to browse
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    PNG, JPG, WEBP · max {MAX_FILE_MB}MB
                  </p>
                </>
              )}
            </label>
          ) : (
            <div>
              <label className="block text-[12px] font-medium text-slate-700 mb-1">
                Image URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-[12px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Must start with <code>/</code>, <code>http://</code>, or{' '}
                <code>https://</code>.
              </p>
            </div>
          )}

          {localError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-2.5 py-2 rounded-md flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{localError}</span>
            </div>
          )}

          {selected && (
            <div className="border border-slate-200 rounded-md p-2">
              <p className="text-[11px] font-medium text-slate-500 mb-1">
                Preview
              </p>
              <div className="aspect-square max-w-[150px] mx-auto rounded-md overflow-hidden bg-slate-50 border border-slate-200">
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

        <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-1.5 rounded-md text-[12px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => selected && onSelect(selected)}
            disabled={!selected || uploading}
            className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded-md text-[12px] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            <Check className="w-3 h-3" />
            Use image
          </button>
        </div>
      </div>
    </div>
  );
}

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
      <span className="block font-medium text-slate-700 mb-1 text-[12px]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-blue-950 ${
          mono ? 'font-mono text-slate-600' : 'text-slate-900'
        }`}
      />
    </label>
  );
}