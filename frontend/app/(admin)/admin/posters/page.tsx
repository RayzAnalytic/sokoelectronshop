'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    Plus,
    Search,
    Pencil,
    Trash2,
    Copy,
    ArrowUp,
    ArrowDown,
    X,
    ImagePlus,
    Save,
    Loader2,
    AlertTriangle,
    RefreshCw,
    ServerCrash,
} from 'lucide-react';
import { adminApi, resolveMediaUrl } from '@/lib/admin-api';
import type { AdminPoster, AdminPosterStatus } from '@/lib/admin-types';

const PLACEMENT = 'HOME_AFTER_BESTSELLING';
const MAX_VISIBLE = 6;

type PosterStatus = AdminPosterStatus;

type Poster = AdminPoster;

interface Draft {
    placement: string;
    order: number;
    headline: string;
    subheadline: string;
    brand_name: string;
    sponsor_label: string;
    cta_text: string;
    cta_href: string;
    start_at: string;
    end_at: string;
    is_published: boolean;
    desktopFile: File | null;
    mobileFile: File | null;
    desktop_image: string;
    mobile_image: string;
}

function toLocalInput(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours(),
    )}:${pad(d.getMinutes())}`;
}

function toDraft(source: Poster | 'new', nextOrder: number): Draft {
    if (source === 'new') {
        return {
            placement: PLACEMENT,
            order: nextOrder,
            headline: '',
            subheadline: '',
            brand_name: '',
            sponsor_label: '',
            cta_text: 'Shop now',
            cta_href: '/',
            start_at: '',
            end_at: '',
            is_published: true,
            desktopFile: null,
            mobileFile: null,
            desktop_image: '',
            mobile_image: '',
        };
    }
    return {
        placement: source.placement || PLACEMENT,
        order: source.order ?? 1,
        headline: source.headline || '',
        subheadline: source.subheadline || '',
        brand_name: source.brand_name || '',
        sponsor_label: source.sponsor_label || '',
        cta_text: source.cta_text || '',
        cta_href: source.cta_href || '',
        start_at: source.start_at ? toLocalInput(source.start_at) : '',
        end_at: source.end_at ? toLocalInput(source.end_at) : '',
        is_published: source.is_published ?? source.status !== 'PAUSED',
        desktopFile: null,
        mobileFile: null,
        desktop_image: source.desktop_image || '',
        mobile_image: source.mobile_image || '',
    };
}

const inputCls =
    'w-full rounded border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-950 focus:ring-1 focus:ring-blue-950/20';

const btnPrimary =
    'inline-flex items-center justify-center space-x-2 rounded bg-blue-950 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50';

const btnGhost =
    'inline-flex items-center justify-center space-x-2 rounded border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';

const btnIcon =
    'inline-flex items-center justify-center rounded border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40';

const btnIconDanger =
    'inline-flex items-center justify-center rounded border border-rose-200 bg-white p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-40';

function StatusBadge({ status }: { status: PosterStatus }) {
    const map: Record<PosterStatus, string> = {
        ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        SCHEDULED: 'bg-blue-50 text-blue-700 border-blue-200',
        PAUSED: 'bg-amber-50 text-amber-700 border-amber-200',
        EXPIRED: 'bg-slate-50 text-slate-600 border-slate-200',
    };
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${map[status]}`}
        >
            {status}
        </span>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase text-slate-500">
                {label}
            </span>
            {children}
        </label>
    );
}

function ImageField({
    label,
    file,
    url,
    onFile,
    onClear,
}: {
    label: string;
    file: File | null;
    url: string;
    onFile: (f: File | null) => void;
    onClear: () => void;
}) {
    const preview = useMemo(
        () => (file ? URL.createObjectURL(file) : resolveMediaUrl(url)),
        [file, url],
    );

    useEffect(() => {
        if (file && preview) return () => URL.revokeObjectURL(preview);
        return;
    }, [file, preview]);

    return (
        <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase text-slate-500">
                {label}
            </span>
            <label className="flex items-center space-x-2 rounded border border-dashed border-slate-300 bg-white px-2 py-2 text-sm text-slate-600 cursor-pointer hover:border-blue-950 hover:text-blue-950">
                <ImagePlus className="h-4 w-4 shrink-0" />
                <span className="truncate flex-1">
                    {file ? file.name : url ? 'Replace image' : 'Upload image'}
                </span>
                <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onFile(e.target.files?.[0] || null)}
                />
            </label>
            {preview && (
                <div className="flex items-center space-x-2 rounded border border-slate-200 bg-slate-50 p-1">
                    <img src={preview} alt="" className="h-8 w-14 rounded object-cover" />
                    <button
                        type="button"
                        onClick={onClear}
                        className="ml-auto rounded p-1 text-slate-500 hover:bg-white hover:text-rose-600"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}
        </div>
    );
}

function PosterPreview({ draft }: { draft: Draft }) {
    const desktop = useMemo(
        () =>
            draft.desktopFile
                ? URL.createObjectURL(draft.desktopFile)
                : resolveMediaUrl(draft.desktop_image),
        [draft.desktopFile, draft.desktop_image],
    );
    const mobile = useMemo(
        () =>
            draft.mobileFile
                ? URL.createObjectURL(draft.mobileFile)
                : resolveMediaUrl(draft.mobile_image),
        [draft.mobileFile, draft.mobile_image],
    );
    const img = desktop || mobile;

    useEffect(() => {
        if (draft.desktopFile && desktop) {
            return () => URL.revokeObjectURL(desktop);
        }
        return;
    }, [draft.desktopFile, desktop]);

    useEffect(() => {
        if (draft.mobileFile && mobile) {
            return () => URL.revokeObjectURL(mobile);
        }
        return;
    }, [draft.mobileFile, mobile]);

    return (
        <div className="relative w-full aspect-[16/9] rounded overflow-hidden bg-blue-950 border border-slate-200">
            {img && (
                <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-950/90 via-blue-950/45 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-blue-950/55 via-transparent to-transparent" />
            <div className="relative flex h-full max-w-[78%] flex-col items-start justify-end p-3 text-white">
                {draft.sponsor_label && (
                    <span className="mb-1 inline-flex rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase text-white/90">
                        {draft.sponsor_label}
                    </span>
                )}
                {draft.brand_name && (
                    <span className="mb-1 text-[12px] font-bold uppercase text-white/65">
                        {draft.brand_name}
                    </span>
                )}
                <h3 className="text-base font-extrabold">
                    {draft.headline || 'Your headline'}
                </h3>
                {draft.subheadline && (
                    <p className="mt-1 line-clamp-2 text-[11px] text-white/80">
                        {draft.subheadline}
                    </p>
                )}
                {draft.cta_text && (
                    <span className="mt-1 inline-flex items-center rounded-full bg-white px-2 py-1 text-[12px] font-bold text-blue-950">
                        {draft.cta_text}
                    </span>
                )}
            </div>
        </div>
    );
}

function PosterRow({
    poster,
    canUp,
    canDown,
    busy,
    onEdit,
    onDelete,
    onDuplicate,
    onMove,
}: {
    poster: Poster;
    canUp: boolean;
    canDown: boolean;
    busy: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onMove: (dir: -1 | 1) => void;
}) {
    const thumb = resolveMediaUrl(poster.desktop_image || poster.mobile_image || '');
    return (
        <div className="rounded border border-slate-200 bg-white p-2 space-y-2">
            <div className="flex items-center space-x-2">
                <div className="flex flex-col space-y-1">
                    <button
                        type="button"
                        onClick={() => onMove(-1)}
                        disabled={!canUp || busy}
                        className={`${btnIcon} p-1`}
                        title="Move up"
                    >
                        <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onMove(1)}
                        disabled={!canDown || busy}
                        className={`${btnIcon} p-1`}
                        title="Move down"
                    >
                        <ArrowDown className="h-3 w-3" />
                    </button>
                </div>

                <div className="h-12 w-20 rounded bg-blue-950 overflow-hidden shrink-0">
                    {thumb ? (
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : null}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center space-x-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-blue-950 truncate">
                            {poster.headline || 'Untitled'}
                        </h3>
                        <StatusBadge status={poster.status} />
                        <span className="text-[13px] text-slate-400">#{poster.order}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-[13px] text-slate-500 flex-wrap">
                        {poster.brand_name && <span>{poster.brand_name}</span>}
                        {poster.sponsor_label && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">
                                {poster.sponsor_label}
                            </span>
                        )}
                        {poster.start_at && (
                            <span>Start: {new Date(poster.start_at).toLocaleDateString()}</span>
                        )}
                        {poster.end_at && (
                            <span>End: {new Date(poster.end_at).toLocaleDateString()}</span>
                        )}
                        {typeof poster.impression_count === 'number' && (
                            <span>Impr: {poster.impression_count}</span>
                        )}
                        {typeof poster.click_count === 'number' && (
                            <span>Clicks: {poster.click_count}</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center space-x-1">
                    <button
                        type="button"
                        onClick={onEdit}
                        disabled={busy}
                        className={btnIcon}
                        title="Edit"
                    >
                        <Pencil className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onDuplicate}
                        disabled={busy}
                        className={btnIcon}
                        title="Duplicate"
                    >
                        <Copy className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        disabled={busy}
                        className={btnIconDanger}
                        title="Delete"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function PosterEditor({
    source,
    nextOrder,
    onClose,
    onSaved,
}: {
    source: Poster | 'new';
    nextOrder: number;
    onClose: () => void;
    onSaved: () => void;
}) {
    const isNew = source === 'new';
    const initial = useMemo(() => toDraft(source, nextOrder), [source, nextOrder]);
    const [draft, setDraft] = useState<Draft>(initial);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
        setDraft((d) => ({ ...d, [key]: value }));

    const save = async () => {
        setErr(null);
        if (!draft.headline.trim()) {
            setErr('Headline is required');
            return;
        }
        if (draft.start_at && draft.end_at) {
            if (new Date(draft.start_at) >= new Date(draft.end_at)) {
                setErr('Start date must be before end date');
                return;
            }
        }

        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('placement', draft.placement);
            fd.append('order', String(draft.order));
            fd.append('headline', draft.headline.trim());
            fd.append('subheadline', draft.subheadline);
            fd.append('brand_name', draft.brand_name);
            fd.append('sponsor_label', draft.sponsor_label);
            fd.append('cta_text', draft.cta_text);
            fd.append('cta_href', draft.cta_href);
            fd.append('is_published', draft.is_published ? 'true' : 'false');
            fd.append(
                'start_at',
                draft.start_at ? new Date(draft.start_at).toISOString() : '',
            );
            fd.append('end_at', draft.end_at ? new Date(draft.end_at).toISOString() : '');

            if (draft.desktopFile) {
                fd.append('desktop_image', draft.desktopFile);
            } else if (draft.desktop_image !== initial.desktop_image) {
                fd.append('desktop_image', draft.desktop_image || '');
            }

            if (draft.mobileFile) {
                fd.append('mobile_image', draft.mobileFile);
            } else if (draft.mobile_image !== initial.mobile_image) {
                fd.append('mobile_image', draft.mobile_image || '');
            }

            if (isNew) {
                await adminApi.posters.create(fd);
            } else {
                await adminApi.posters.update((source as Poster).id, fd);
            }
            onSaved();
        } catch (e: any) {
            setErr(e.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/40" onClick={onClose} aria-hidden="true" />
            <aside className="w-full max-w-xl h-full overflow-y-auto bg-white border-l border-slate-200 flex flex-col">
                <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between space-x-2">
                    <h2 className="text-sm font-bold text-blue-950">
                        {isNew ? 'New poster' : 'Edit poster'}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 p-2 space-y-2">
                    <PosterPreview draft={draft} />

                    {err && (
                        <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                            {err}
                        </div>
                    )}

                    <Field label="Headline">
                        <input
                            value={draft.headline}
                            onChange={(e) => update('headline', e.target.value)}
                            maxLength={80}
                            placeholder="Lenovo Week"
                            className={inputCls}
                        />
                    </Field>

                    <Field label="Subheadline">
                        <textarea
                            value={draft.subheadline}
                            onChange={(e) => update('subheadline', e.target.value)}
                            rows={2}
                            maxLength={140}
                            placeholder="Discover powerful Legion and ThinkPad laptops."
                            className={inputCls}
                        />
                    </Field>

                    <div className="grid grid-cols-2 gap-2">
                        <Field label="Brand name">
                            <input
                                value={draft.brand_name}
                                onChange={(e) => update('brand_name', e.target.value)}
                                className={inputCls}
                            />
                        </Field>
                        <Field label="Sponsor label">
                            <input
                                value={draft.sponsor_label}
                                onChange={(e) => update('sponsor_label', e.target.value)}
                                className={inputCls}
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <Field label="CTA text">
                            <input
                                value={draft.cta_text}
                                onChange={(e) => update('cta_text', e.target.value)}
                                className={inputCls}
                            />
                        </Field>
                        <Field label="CTA link">
                            <input
                                value={draft.cta_href}
                                onChange={(e) => update('cta_href', e.target.value)}
                                placeholder="/categories/laptops"
                                className={inputCls}
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <ImageField
                            label="Desktop image"
                            file={draft.desktopFile}
                            url={draft.desktop_image}
                            onFile={(f) => update('desktopFile', f)}
                            onClear={() => {
                                update('desktopFile', null);
                                update('desktop_image', '');
                            }}
                        />
                        <ImageField
                            label="Mobile image"
                            file={draft.mobileFile}
                            url={draft.mobile_image}
                            onFile={(f) => update('mobileFile', f)}
                            onClear={() => {
                                update('mobileFile', null);
                                update('mobile_image', '');
                            }}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <Field label="Start date">
                            <input
                                type="datetime-local"
                                value={draft.start_at}
                                onChange={(e) => update('start_at', e.target.value)}
                                className={inputCls}
                            />
                        </Field>
                        <Field label="End date">
                            <input
                                type="datetime-local"
                                value={draft.end_at}
                                onChange={(e) => update('end_at', e.target.value)}
                                className={inputCls}
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <Field label="Order">
                            <input
                                type="number"
                                min={0}
                                value={draft.order}
                                onChange={(e) => update('order', Number(e.target.value) || 0)}
                                className={inputCls}
                            />
                        </Field>
                        <Field label="Published">
                            <label className="flex items-center space-x-2 rounded border border-slate-200 bg-white px-3 py-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={draft.is_published}
                                    onChange={(e) => update('is_published', e.target.checked)}
                                />
                                <span className="text-sm text-slate-700">
                                    {draft.is_published ? 'Live' : 'Paused'}
                                </span>
                            </label>
                        </Field>
                    </div>
                </div>

                <div className="sticky bottom-0 bg-white border-t border-slate-200 px-3 py-2 flex items-center justify-end space-x-2">
                    <button type="button" onClick={onClose} className={btnGhost}>
                        Cancel
                    </button>
                    <button type="button" onClick={save} disabled={saving} className={btnPrimary}>
                        {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        <span>{isNew ? 'Create poster' : 'Save changes'}</span>
                    </button>
                </div>
            </aside>
        </div>
    );
}

export default function AdminPostersPage() {
    const [posters, setPosters] = useState<Poster[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | PosterStatus>('ALL');
    const [editing, setEditing] = useState<Poster | 'new' | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const rows = await adminApi.posters.list({ placement: PLACEMENT });
            setPosters([...rows].sort((a, b) => a.order - b.order));
        } catch (e: any) {
            setError(e.message || 'Failed to load posters');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const sortedAll = useMemo(
        () => [...posters].sort((a, b) => a.order - b.order),
        [posters],
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return sortedAll.filter((p) => {
            if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
            if (!q) return true;
            return (
                (p.headline || '').toLowerCase().includes(q) ||
                (p.subheadline || '').toLowerCase().includes(q) ||
                (p.brand_name || '').toLowerCase().includes(q)
            );
        });
    }, [sortedAll, search, statusFilter]);

    const liveCount = posters.filter((p) => p.status === 'ACTIVE').length;

    const handleDelete = async (poster: Poster) => {
        if (!window.confirm(`Delete "${poster.headline}"?`)) return;
        setBusyId(poster.id);
        try {
            await adminApi.posters.remove(poster.id);
            setPosters((prev) => prev.filter((p) => p.id !== poster.id));
        } catch (e: any) {
            window.alert(e.message || 'Delete failed');
        } finally {
            setBusyId(null);
        }
    };

    const handleDuplicate = async (poster: Poster) => {
        setBusyId(poster.id);
        try {
            await adminApi.posters.create({
                placement: poster.placement || PLACEMENT,
                order: (sortedAll[sortedAll.length - 1]?.order ?? 0) + 1,
                headline: `${poster.headline} (copy)`,
                subheadline: poster.subheadline,
                cta_text: poster.cta_text,
                cta_href: poster.cta_href,
                brand_name: poster.brand_name,
                sponsor_label: poster.sponsor_label,
                is_published: false,
            });
            await load();
        } catch (e: any) {
            window.alert(e.message || 'Duplicate failed');
        } finally {
            setBusyId(null);
        }
    };

    const move = async (poster: Poster, direction: -1 | 1) => {
        const idx = sortedAll.findIndex((p) => p.id === poster.id);
        const swapIdx = idx + direction;
        if (idx < 0 || swapIdx < 0 || swapIdx >= sortedAll.length) return;
        const a = sortedAll[idx];
        const b = sortedAll[swapIdx];
        setBusyId(poster.id);
        try {
            await adminApi.posters.reorder([
                { id: a.id, order: b.order },
                { id: b.id, order: a.order },
            ]);
            await load();
        } catch (e: any) {
            window.alert(e.message || 'Reorder failed');
        } finally {
            setBusyId(null);
        }
    };

    const nextOrder = (sortedAll[sortedAll.length - 1]?.order ?? 0) + 1;

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto max-w-7xl p-2 space-y-2">
                <div className="rounded border border-slate-200 bg-white p-2 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="space-y-1">
                            <h1 className="text-lg font-bold text-blue-950">Posters</h1>
                            <p className="text-xs text-slate-500">
                                Placement:{' '}
                                <span className="font-semibold text-blue-950">{PLACEMENT}</span>
                            </p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                type="button"
                                onClick={load}
                                className={btnGhost}
                                title="Refresh"
                            >
                                <RefreshCw className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditing('new')}
                                className={btnPrimary}
                            >
                                <Plus className="h-4 w-4" />
                                <span>New poster</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search headline, brand…"
                                className={`${inputCls} pl-9`}
                            />
                        </div>

                        <div className="flex items-center space-x-1 rounded border border-slate-200 bg-white p-1">
                            {(['ALL', 'ACTIVE', 'SCHEDULED', 'PAUSED', 'EXPIRED'] as const).map(
                                (s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setStatusFilter(s)}
                                        className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${statusFilter === s
                                            ? 'bg-blue-950 text-white'
                                            : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                    >
                                        {s === 'ALL' ? 'All' : s}
                                    </button>
                                ),
                            )}
                        </div>
                    </div>
                </div>

                {liveCount > MAX_VISIBLE && (
                    <div className="flex items-center space-x-2 rounded border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-800">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>
                            <strong>{liveCount}</strong> posters are live. Only the top{' '}
                            <strong>{MAX_VISIBLE}</strong> by order are shown on the storefront.
                        </span>
                    </div>
                )}

                {error && (
                    <div className="flex items-start space-x-2 rounded border border-rose-200 bg-rose-50 px-2 py-2 text-xs text-rose-700">
                        <ServerCrash className="h-4 w-4 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <div className="font-semibold">Could not load posters</div>
                            <div className="text-rose-600">{error}</div>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    {loading ? (
                        <div className="flex items-center justify-center rounded border border-slate-200 bg-white p-6">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-950" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="rounded border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                            No posters match your filters. Click{' '}
                            <strong className="text-blue-950">New poster</strong> to add one.
                        </div>
                    ) : (
                        filtered.map((poster) => {
                            const idxInAll = sortedAll.findIndex((x) => x.id === poster.id);
                            return (
                                <PosterRow
                                    key={poster.id}
                                    poster={poster}
                                    canUp={idxInAll > 0}
                                    canDown={idxInAll >= 0 && idxInAll < sortedAll.length - 1}
                                    busy={busyId === poster.id}
                                    onEdit={() => setEditing(poster)}
                                    onDelete={() => handleDelete(poster)}
                                    onDuplicate={() => handleDuplicate(poster)}
                                    onMove={(dir) => move(poster, dir)}
                                />
                            );
                        })
                    )}
                </div>
            </div>

            {editing && (
                <PosterEditor
                    source={editing}
                    nextOrder={nextOrder}
                    onClose={() => setEditing(null)}
                    onSaved={async () => {
                        setEditing(null);
                        await load();
                    }}
                />
            )}
        </div>
    );
}