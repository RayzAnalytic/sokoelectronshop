'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Upload, Check, Image as ImageIcon, Trash2, Link as LinkIcon } from 'lucide-react';

type BrandStatus = 'Active' | 'Inactive';

interface Brand {
  id?: string;
  name: string;
  slug: string;
  logo: string;
  status: BrandStatus;
  description?: string;
  websiteUrl?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (brand: Omit<Brand, 'id'> & { id?: string }) => void;
  initial?: Brand | null;
}

const EMPTY = {
  name: '',
  slug: '',
  logo: '',
  description: '',
  websiteUrl: '',
  status: 'Active' as BrandStatus,
};

export default function AddBrandModal({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        name: initial.name,
        slug: initial.slug,
        logo: initial.logo ?? '',
        description: initial.description ?? '',
        websiteUrl: initial.websiteUrl ?? '',
        status: initial.status,
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, initial]);

  // Auto-slug
  useEffect(() => {
    const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    setForm((prev) => ({ ...prev, slug }));
  }, [form.name]);

  // ESC + body lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (imagePickerOpen) setImagePickerOpen(false);
        else onClose();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, imagePickerOpen, onClose]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    setIsSaving(true);
    setTimeout(() => {
      onSave({
        id: initial?.id,
        name: form.name,
        slug: form.slug || 'brand',
        logo: form.logo || '/placeholder.jpeg',
        description: form.description,
        websiteUrl: form.websiteUrl,
        status: form.status,
      });
      setIsSaving(false);
      onClose();
    }, 400);
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3">
        <div className="bg-white border border-slate-200 rounded-sm max-w-md w-full max-h-[90vh] flex flex-col shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 shrink-0">
            <h2 className="text-[15px] font-semibold text-slate-900">
              {initial ? 'Edit brand' : 'Add brand'}
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
              <label className="block font-medium text-slate-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief overview of the brand and its catalog…"
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

            {/* Logo upload */}
            <div>
              <label className="block font-medium text-slate-700 mb-1">Brand logo</label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-sm bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {form.logo ? (
                    <img src={form.logo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => setImagePickerOpen(true)}
                    className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {form.logo ? 'Change logo' : 'Upload logo'}
                  </button>
                  {form.logo && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, logo: '' })}
                      className="inline-flex items-center gap-1.5 text-red-600 hover:underline text-[13px] font-medium px-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove logo
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[13px] text-slate-400 mt-1">Square image, min 300×300px recommended.</p>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="font-medium text-slate-700">Status</span>
              <div className="inline-flex bg-slate-100 p-0.5 rounded-sm">
                {(['Active', 'Inactive'] as BrandStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm({ ...form, status: s })}
                    className={`px-3 py-1.5 rounded-sm text-[13px] font-medium transition ${
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
              {isSaving ? 'Saving…' : initial ? 'Save changes' : 'Save brand'}
            </button>
          </div>
        </div>
      </div>

      {/* IMAGE PICKER POPUP */}
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

/* ---------- Image picker sub-modal ---------- */
function ImagePickerModal({ onClose, onSelect }: { onClose: () => void; onSelect: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<'upload' | 'url'>('upload');

  const handleFile = (file?: File) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="bg-white border border-slate-200 rounded-sm max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
          <h3 className="text-[15px] font-semibold text-slate-900">Choose logo</h3>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1 p-2 bg-slate-50 border-b border-slate-200">
          <button
            onClick={() => setMode('upload')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-sm text-[13px] font-medium transition ${
              mode === 'upload' ? 'bg-white text-blue-950 shadow-sm border border-slate-200' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload
          </button>
          <button
            onClick={() => setMode('url')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-sm text-[13px] font-medium transition ${
              mode === 'url' ? 'bg-white text-blue-950 shadow-sm border border-slate-200' : 'text-slate-600 hover:bg-slate-100'
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
              <Upload className="w-7 h-7 mx-auto text-slate-400" />
              <p className="text-[13px] font-medium text-slate-900 mt-2">Drop an image or click to browse</p>
              <p className="text-[13px] text-slate-500 mt-0.5">PNG, JPG, WEBP · max 2MB</p>
            </label>
          ) : (
            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1">Image URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>
          )}

          {(preview || (mode === 'url' && url)) && (
            <div className="border border-slate-200 rounded-sm p-2">
              <p className="text-[13px] font-medium text-slate-500 mb-1">Preview</p>
              <div className="aspect-square max-w-[160px] mx-auto rounded-sm overflow-hidden bg-slate-50 border border-slate-200">
                <img
                  src={preview || url}
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
            onClick={onClose}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const value = preview || url;
              if (value) onSelect(value);
            }}
            disabled={!(preview || url)}
            className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            Use image
          </button>
        </div>
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
        className={`w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 ${
          mono ? 'font-mono text-slate-600' : 'text-slate-900'
        }`}
      />
    </label>
  );
}