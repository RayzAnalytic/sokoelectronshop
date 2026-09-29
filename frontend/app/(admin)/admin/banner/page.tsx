'use client';

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import Link from 'next/link';
import {
    ArrowRight,
    Copy,
    Eye,
    LayoutGrid,
    List,
    Pencil,
    Plus,
    Power,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import {
    type Banner,
    type Placement,
    type Status,
    type Alignment,
    type Overlay,
    SEED_BANNERS,
    loadBanners,
    saveBanners,
    resetBanners,
    ctr,
    fmt,
    fmtDate,
} from '@/lib/bannerStore';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<Status, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    SCHEDULED: 'bg-blue-50 text-blue-800 border-blue-100',
    DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
    EXPIRED: 'bg-rose-50 text-rose-700 border-rose-100',
};

const PLACEMENT_LABEL: Record<Placement, string> = {
    HOME_HERO: 'Homepage hero',
    CATEGORY_HERO: 'Category hero',
    PROMO_STRIP: 'Promo strip',
};

const inputCls =
    'w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-950';

const selectCls =
    'bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-950';

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function BannersPage() {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [hydrated, setHydrated] = useState(false);

    const [view, setView] = useState<'grid' | 'table'>('grid');
    const [query, setQuery] = useState('');
    const [placement, setPlacement] = useState<'ALL' | Placement>('ALL');
    const [status, setStatus] = useState<'ALL' | Status>('ALL');
    const [sort, setSort] = useState<'recent' | 'order' | 'name' | 'ctr'>('order');

    const [editing, setEditing] = useState<Banner | null>(null);
    const [previewing, setPreviewing] = useState<Banner | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Banner | null>(null);
    const [toast, setToast] = useState('');

    useEffect(() => {
        setBanners(loadBanners());
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (hydrated) saveBanners(banners);
    }, [banners, hydrated]);

    const filtered = useMemo(() => {
        let list = [...banners];
        if (query.trim()) {
            const q = query.toLowerCase();
            list = list.filter(
                (b) =>
                    b.name.toLowerCase().includes(q) ||
                    b.headline.toLowerCase().includes(q) ||
                    b.badge.toLowerCase().includes(q),
            );
        }
        if (placement !== 'ALL') list = list.filter((b) => b.placement === placement);
        if (status !== 'ALL') list = list.filter((b) => b.status === status);

        switch (sort) {
            case 'recent':
                list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
                break;
            case 'name':
                list.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'ctr':
                list.sort((a, b) => ctr(b) - ctr(a));
                break;
            default:
                list.sort((a, b) => a.order - b.order);
        }
        return list;
    }, [banners, query, placement, status, sort]);

    function flash(msg: string) {
        setToast(msg);
        setTimeout(() => setToast(''), 2200);
    }

    function save(draft: Banner) {
        setBanners((prev) => {
            const exists = prev.some((b) => b.id === draft.id);
            return exists
                ? prev.map((b) => (b.id === draft.id ? draft : b))
                : [...prev, { ...draft, id: Math.max(0, ...prev.map((p) => p.id)) + 1 }];
        });
        setEditing(null);
        flash('Banner saved');
    }

    function duplicate(b: Banner) {
        const copy: Banner = {
            ...b,
            id: Math.max(0, ...banners.map((p) => p.id)) + 1,
            name: `${b.name} (copy)`,
            status: 'DRAFT',
            impressions: 0,
            clicks: 0,
            conversions: 0,
            updated_at: new Date().toISOString(),
        };
        setBanners((prev) => [...prev, copy]);
        flash('Banner duplicated');
    }

    function toggle(b: Banner) {
        setBanners((prev) =>
            prev.map((p) =>
                p.id === b.id
                    ? { ...p, status: p.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE' }
                    : p,
            ),
        );
        flash(b.status === 'ACTIVE' ? 'Deactivated' : 'Activated');
    }

    function remove(b: Banner) {
        setBanners((prev) => prev.filter((p) => p.id !== b.id));
        setConfirmDelete(null);
        flash('Banner deleted');
    }

    function blank(): Banner {
        return {
            id: 0,
            name: '',
            placement: 'HOME_HERO',
            order: banners.length + 1,
            badge: '',
            headline: '',
            description: '',
            desktop_image: '',
            tablet_image: '',
            mobile_image: '',
            primary_cta_text: '',
            primary_cta_href: '',
            secondary_cta_text: '',
            secondary_cta_href: '',
            text_alignment: 'LEFT',
            overlay_style: 'GRADIENT',
            overlay_opacity: 80,
            status: 'DRAFT',
            start_at: '',
            end_at: '',
            impressions: 0,
            clicks: 0,
            conversions: 0,
            updated_at: new Date().toISOString(),
        };
    }

    const stats = useMemo(() => {
        const active = banners.filter((b) => b.status === 'ACTIVE').length;
        const totalImpr = banners.reduce((s, b) => s + b.impressions, 0);
        const totalClicks = banners.reduce((s, b) => s + b.clicks, 0);
        const totalConv = banners.reduce((s, b) => s + b.conversions, 0);
        return { active, totalImpr, totalClicks, totalConv };
    }, [banners]);

    if (!hydrated) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <svg
                    className="animate-spin w-5 h-5 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-[15px] font-semibold text-slate-900">Banners</h1>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                            Manage homepage hero slides and promotional banners · {banners.length} banners
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                if (
                                    confirm(
                                        'Reset all banners to the demo seed? Your uploads will be lost.',
                                    )
                                ) {
                                    resetBanners();
                                    setBanners(SEED_BANNERS);
                                    flash('Reset to seed');
                                }
                            }}
                            className="text-[13px] text-slate-500 hover:text-slate-800 px-2 py-2 hidden sm:inline"
                        >
                            Reset demo
                        </button>
                        <div className="inline-flex bg-slate-100 p-0.5 rounded-sm border border-slate-200">
                            <button
                                onClick={() => setView('grid')}
                                className={`p-1.5 rounded-sm transition ${view === 'grid' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                                title="Grid view"
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setView('table')}
                                className={`p-1.5 rounded-sm transition ${view === 'table' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                                title="Table view"
                            >
                                <List className="w-4 h-4" />
                            </button>
                        </div>
                        <button
                            onClick={() => setEditing(blank())}
                            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>New banner</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

                {/* ── Summary cards ──────────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                        { label: 'Active banners', value: stats.active.toString(), icon: Power, color: 'text-emerald-700 bg-emerald-50' },
                        { label: 'Impressions', value: fmt(stats.totalImpr), icon: Eye, color: 'text-blue-950 bg-blue-50' },
                        { label: 'Clicks', value: fmt(stats.totalClicks), icon: ArrowRight, color: 'text-indigo-700 bg-indigo-50' },
                        { label: 'Conversions', value: fmt(stats.totalConv), icon: Copy, color: 'text-amber-700 bg-amber-50' },
                    ].map((s) => (
                        <div key={s.label} className="bg-white border border-slate-200 rounded-sm p-2 space-y-1.5">
                            <div className="flex items-center gap-1.5">
                                <span className={`w-6 h-6 rounded-sm flex items-center justify-center ${s.color}`}>
                                    <s.icon className="w-3.5 h-3.5" />
                                </span>
                                <span className="text-[13px] font-medium text-slate-500 truncate">{s.label}</span>
                            </div>
                            <div className="text-[15px] font-bold text-slate-900">{s.value}</div>
                        </div>
                    ))}
                </div>

                {/* ── Toolbar ────────────────────────────────────────────── */}
                <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search banners by name, headline, or badge…"
                            className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-950"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={placement}
                            onChange={(e) => setPlacement(e.target.value as typeof placement)}
                            className={selectCls}
                        >
                            <option value="ALL">All placements</option>
                            <option value="HOME_HERO">Homepage hero</option>
                            <option value="CATEGORY_HERO">Category hero</option>
                            <option value="PROMO_STRIP">Promo strip</option>
                        </select>

                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as typeof status)}
                            className={selectCls}
                        >
                            <option value="ALL">All statuses</option>
                            <option value="ACTIVE">Active</option>
                            <option value="SCHEDULED">Scheduled</option>
                            <option value="DRAFT">Draft</option>
                            <option value="EXPIRED">Expired</option>
                        </select>

                        <select
                            value={sort}
                            onChange={(e) => setSort(e.target.value as typeof sort)}
                            className={selectCls}
                        >
                            <option value="order">Slide order</option>
                            <option value="recent">Recently updated</option>
                            <option value="name">Name A–Z</option>
                            <option value="ctr">Highest CTR</option>
                        </select>
                    </div>
                </div>

                {/* ── Content ────────────────────────────────────────────── */}
                {filtered.length === 0 ? (
                    <EmptyState onCreate={() => setEditing(blank())} />
                ) : view === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {filtered.map((b) => (
                            <BannerCard
                                key={b.id}
                                banner={b}
                                onEdit={() => setEditing(b)}
                                onPreview={() => setPreviewing(b)}
                                onDuplicate={() => duplicate(b)}
                                onToggle={() => toggle(b)}
                                onDelete={() => setConfirmDelete(b)}
                            />
                        ))}
                    </div>
                ) : (
                    <BannerTable
                        banners={filtered}
                        onEdit={setEditing}
                        onPreview={setPreviewing}
                        onDuplicate={duplicate}
                        onToggle={toggle}
                        onDelete={setConfirmDelete}
                    />
                )}
            </main>

            {/* ── Editor ───────────────────────────────────────────────── */}
            {editing && (
                <BannerEditor
                    initial={editing}
                    onSave={save}
                    onClose={() => setEditing(null)}
                />
            )}

            {/* ── Preview ─────────────────────────────────────────────── */}
            {previewing && (
                <PreviewModal banner={previewing} onClose={() => setPreviewing(null)} />
            )}

            {/* ── Delete confirm ──────────────────────────────────────── */}
            {confirmDelete && (
                <div
                    className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
                    onClick={() => setConfirmDelete(null)}
                >
                    <div
                        className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2">
                            <span className="w-9 h-9 rounded-sm bg-red-50 text-red-600 flex items-center justify-center">
                                <Trash2 className="w-4 h-4" />
                            </span>
                            <h3 className="text-[15px] font-semibold text-slate-900">Delete banner?</h3>
                        </div>
                        <p className="text-[13px] text-slate-500 mt-2">
                            &ldquo;{confirmDelete.name}&rdquo; will be permanently removed. This cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2 mt-3">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => remove(confirmDelete)}
                                className="bg-red-600 hover:bg-red-500 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toast ──────────────────────────────────────────────── */}
            {toast && (
                <div className="fixed bottom-4 right-4 z-[110] bg-slate-900 text-white text-[13px] px-4 py-2.5 rounded-sm shadow-lg">
                    {toast}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid card
// ─────────────────────────────────────────────────────────────────────────────
function BannerCard({
    banner,
    onEdit,
    onPreview,
    onDuplicate,
    onToggle,
    onDelete,
}: {
    banner: Banner;
    onEdit: () => void;
    onPreview: () => void;
    onDuplicate: () => void;
    onToggle: () => void;
    onDelete: () => void;
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2 relative">
            <div className="relative aspect-[4/3] rounded-sm overflow-hidden bg-slate-950 border border-slate-200">
                <SlideArt banner={banner} />
                <span className="absolute top-2 right-2 bg-blue-950 text-white font-medium text-[13px] px-2 py-0.5 rounded-sm">
                    {banner.status}
                </span>
                <span className="absolute top-2 left-2 bg-white/90 text-slate-700 font-medium text-[13px] px-2 py-0.5 rounded-sm border border-slate-200">
                    #{banner.order}
                </span>
            </div>

            <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-blue-950 uppercase tracking-wide truncate">
                        {PLACEMENT_LABEL[banner.placement]}
                    </span>
                </div>
                <h3 className="text-[13px] font-medium text-slate-900 line-clamp-1">
                    {banner.name || 'Untitled banner'}
                </h3>
                <p className="text-[13px] text-slate-400 line-clamp-2">
                    {banner.headline || '—'}
                </p>
                <p className="text-[11px] text-slate-400">Updated {fmtDate(banner.updated_at)}</p>
            </div>

            {/* Mini stats */}
            <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100">
                <MiniStat label="Impr." value={fmt(banner.impressions)} />
                <MiniStat label="CTR" value={`${ctr(banner).toFixed(1)}%`} />
                <MiniStat label="Conv." value={fmt(banner.conversions)} />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-0.5 pt-1 border-t border-slate-100">
                <IconButton title="Edit" onClick={onEdit}>
                    <Pencil className="w-3.5 h-3.5" />
                </IconButton>
                <IconButton title="Preview" onClick={onPreview}>
                    <Eye className="w-3.5 h-3.5" />
                </IconButton>
                <IconButton title="Duplicate" onClick={onDuplicate}>
                    <Copy className="w-3.5 h-3.5" />
                </IconButton>
                <IconButton
                    title={banner.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    onClick={onToggle}
                >
                    <Power className="w-3.5 h-3.5" />
                </IconButton>
                <div className="ml-auto">
                    <IconButton title="Delete" onClick={onDelete} danger>
                        <Trash2 className="w-3.5 h-3.5" />
                    </IconButton>
                </div>
            </div>
        </div>
    );
}

function MiniStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="text-center">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">
                {label}
            </div>
            <div className="text-[12px] font-semibold text-slate-800 mt-0.5">
                {value}
            </div>
        </div>
    );
}

function IconButton({
    title,
    onClick,
    children,
    danger,
}: {
    title: string;
    onClick: () => void;
    children: React.ReactNode;
    danger?: boolean;
}) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            className={`p-1.5 rounded-sm transition ${danger
                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                : 'text-slate-500 hover:text-blue-950 hover:bg-slate-100'
                }`}
        >
            {children}
        </button>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Table
// ─────────────────────────────────────────────────────────────────────────────
function BannerTable({
    banners,
    onEdit,
    onPreview,
    onDuplicate,
    onToggle,
    onDelete,
}: {
    banners: Banner[];
    onEdit: (b: Banner) => void;
    onPreview: (b: Banner) => void;
    onDuplicate: (b: Banner) => void;
    onToggle: (b: Banner) => void;
    onDelete: (b: Banner) => void;
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                            <th className="py-2 px-3 font-medium w-16">Order</th>
                            <th className="py-2 px-3 font-medium">Banner</th>
                            <th className="py-2 px-3 font-medium">Placement</th>
                            <th className="py-2 px-3 font-medium">Status</th>
                            <th className="py-2 px-3 font-medium">Schedule</th>
                            <th className="py-2 px-3 font-medium text-right">Impr.</th>
                            <th className="py-2 px-3 font-medium text-right">CTR</th>
                            <th className="py-2 px-3 font-medium text-right">Conv.</th>
                            <th className="py-2 px-3 font-medium text-right w-40">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {banners.map((b) => (
                            <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2 px-3 text-slate-500">#{b.order}</td>
                                <td className="py-2 px-3">
                                    <div className="flex items-center gap-2">
                                        <div className="relative w-14 h-9 rounded-sm overflow-hidden bg-slate-950 border border-slate-200 shrink-0">
                                            <SlideArt banner={b} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-medium text-slate-900 truncate max-w-[220px]">
                                                {b.name || 'Untitled'}
                                            </div>
                                            <div className="text-[11px] text-slate-500 truncate max-w-[220px]">
                                                {b.headline}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-2 px-3 text-slate-600">
                                    {PLACEMENT_LABEL[b.placement]}
                                </td>
                                <td className="py-2 px-3">
                                    <span
                                        className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-sm border ${STATUS_STYLES[b.status]}`}
                                    >
                                        {b.status}
                                    </span>
                                </td>
                                <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                                    {b.start_at ? fmtDate(b.start_at) : '—'} →{' '}
                                    {b.end_at ? fmtDate(b.end_at) : '—'}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-700 tabular-nums">
                                    {fmt(b.impressions)}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-700 tabular-nums">
                                    {ctr(b).toFixed(1)}%
                                </td>
                                <td className="py-2 px-3 text-right text-slate-700 tabular-nums">
                                    {fmt(b.conversions)}
                                </td>
                                <td className="py-2 px-3">
                                    <div className="flex items-center justify-end gap-0.5">
                                        <IconButton title="Edit" onClick={() => onEdit(b)}>
                                            <Pencil className="w-3.5 h-3.5" />
                                        </IconButton>
                                        <IconButton title="Preview" onClick={() => onPreview(b)}>
                                            <Eye className="w-3.5 h-3.5" />
                                        </IconButton>
                                        <IconButton title="Duplicate" onClick={() => onDuplicate(b)}>
                                            <Copy className="w-3.5 h-3.5" />
                                        </IconButton>
                                        <IconButton
                                            title={b.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                            onClick={() => onToggle(b)}
                                        >
                                            <Power className="w-3.5 h-3.5" />
                                        </IconButton>
                                        <IconButton title="Delete" onClick={() => onDelete(b)} danger>
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </IconButton>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState({ onCreate }: { onCreate: () => void }) {
    return (
        <div className="bg-white border border-slate-200 rounded-sm py-16 text-center">
            <div className="w-12 h-12 mx-auto rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center">
                <svg
                    className="w-6 h-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-5-5L5 21" />
                </svg>
            </div>
            <h3 className="text-[15px] font-semibold text-slate-900 mt-3">
                No banners yet
            </h3>
            <p className="text-[13px] text-slate-500 mt-1">
                Add your first hero slide to get started.
            </p>
            <button
                onClick={onCreate}
                className="mt-4 inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
                <Plus className="w-3.5 h-3.5" />
                New banner
            </button>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide art
// ─────────────────────────────────────────────────────────────────────────────
function SlideArt({ banner }: { banner: Banner }) {
    const overlayBg = (() => {
        const o = banner.overlay_opacity / 100;
        switch (banner.overlay_style) {
            case 'DARK':
                return `linear-gradient(rgba(2,6,23,${o}),rgba(2,6,23,${o}))`;
            case 'LIGHT':
                return `linear-gradient(rgba(255,255,255,${o}),rgba(255,255,255,${o}))`;
            case 'GRADIENT':
                return `linear-gradient(90deg, rgba(2,6,23,${o}) 0%, rgba(2,6,23,${o * 0.5}) 50%, rgba(2,6,23,0) 100%)`;
            default:
                return 'none';
        }
    })();

    return (
        <>
            {banner.desktop_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={banner.desktop_image}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                />
            ) : (
                <div className="absolute inset-0 bg-slate-950" />
            )}
            <div className="absolute inset-0" style={{ background: overlayBg }} />
        </>
    );
}

function SlideArtFull({ banner }: { banner: Banner }) {
    const isLight = banner.overlay_style === 'LIGHT';
    const textColor = isLight ? 'text-slate-900' : 'text-white';
    const subColor = isLight ? 'text-slate-700' : 'text-slate-200';
    const align =
        banner.text_alignment === 'CENTER'
            ? 'items-center text-center'
            : banner.text_alignment === 'RIGHT'
                ? 'items-end text-right'
                : 'items-start text-left';

    return (
        <div className="absolute inset-0">
            <SlideArt banner={banner} />
            <div
                className={`absolute inset-0 flex flex-col justify-center ${align} p-6 sm:p-8`}
            >
                {banner.badge && (
                    <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-sm ${isLight ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
                            }`}
                    >
                        {banner.badge}
                    </span>
                )}
                <h3
                    className={`mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight leading-[1.15] ${textColor}`}
                >
                    {banner.headline || 'Your headline here'}
                </h3>
                <p className={`mt-2 text-sm max-w-xl ${subColor}`}>
                    {banner.description}
                </p>
                {(banner.primary_cta_text || banner.secondary_cta_text) && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-3">
                        {banner.primary_cta_text && (
                            <span className="inline-flex items-center justify-center gap-2 bg-white text-slate-900 font-semibold py-2 px-4 rounded-sm text-[13px]">
                                {banner.primary_cta_text}
                                <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                        )}
                        {banner.secondary_cta_text && (
                            <span className="inline-flex items-center justify-center bg-transparent text-white font-medium py-2 px-4 rounded-sm text-[13px] border border-white/30">
                                {banner.secondary_cta_text}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview modal
// ─────────────────────────────────────────────────────────────────────────────
function PreviewModal({
    banner,
    onClose,
}: {
    banner: Banner;
    onClose: () => void;
}) {
    const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>(
        'desktop',
    );
    const widths = {
        desktop: 'max-w-5xl',
        tablet: 'max-w-2xl',
        mobile: 'max-w-md',
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3">
            <div
                className={`w-full ${widths[device]} bg-white rounded-sm border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] transition-all duration-200`}
            >
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-[15px] font-semibold text-slate-900 truncate">
                            {banner.name}
                        </h2>
                        <p className="text-[13px] text-slate-500 truncate">
                            {PLACEMENT_LABEL[banner.placement]} · Live preview
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="inline-flex bg-slate-100 border border-slate-200 rounded-sm p-0.5">
                            {(['desktop', 'tablet', 'mobile'] as const).map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setDevice(d)}
                                    className={`px-2.5 py-1.5 text-[12px] rounded-sm capitalize transition ${device === d
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={onClose}
                            className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-slate-100 p-3 flex justify-center">
                    <div className="w-full">
                        <div className="relative bg-slate-950 overflow-hidden rounded-sm border border-slate-200">
                            <div className="relative aspect-[16/9] sm:aspect-[16/7]">
                                <SlideArtFull banner={banner} />
                            </div>
                        </div>
                        <div className="text-center text-[11px] text-slate-400 mt-2 capitalize">
                            {device} preview
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200 shrink-0">
                    <PreviewStat label="Impressions" value={fmt(banner.impressions)} />
                    <PreviewStat label="CTR" value={`${ctr(banner).toFixed(2)}%`} />
                    <PreviewStat label="Conversions" value={fmt(banner.conversions)} />
                </div>
            </div>
        </div>
    );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="p-2.5 text-center">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">
                {label}
            </div>
            <div className="text-[14px] font-semibold text-slate-900 mt-0.5">
                {value}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Editor drawer
// ─────────────────────────────────────────────────────────────────────────────
function BannerEditor({
    initial,
    onSave,
    onClose,
}: {
    initial: Banner;
    onSave: (b: Banner) => void;
    onClose: () => void;
}) {
    const [draft, setDraft] = useState<Banner>(initial);
    const [tab, setTab] = useState<'content' | 'media' | 'design' | 'schedule'>(
        'content',
    );

    function update<K extends keyof Banner>(key: K, value: Banner[K]) {
        setDraft((d) => ({ ...d, [key]: value }));
    }

    function submit() {
        if (!draft.headline.trim()) {
            alert('Headline is required.');
            return;
        }
        if (!draft.desktop_image) {
            alert('Please upload a desktop image.');
            return;
        }
        onSave({ ...draft, updated_at: new Date().toISOString() });
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-stretch justify-end bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-3xl bg-white flex flex-col shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 shrink-0">
                    <div>
                        <h2 className="text-[15px] font-semibold text-slate-900">
                            {initial.id ? 'Edit banner' : 'New banner'}
                        </h2>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                            Configure content, media, design, and schedule.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-3 border-b border-slate-200 shrink-0">
                    <div className="flex gap-1 -mb-px">
                        {(['content', 'media', 'design', 'schedule'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`px-3 py-2 text-[13px] capitalize border-b-2 transition ${tab === t
                                    ? 'border-blue-950 text-blue-950 font-medium'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto p-3 space-y-3 text-[13px]">
                    {tab === 'content' && (
                        <>
                            <Field label="Banner name (internal)">
                                <input
                                    value={draft.name}
                                    onChange={(e) => update('name', e.target.value)}
                                    placeholder="Launch Week Hero"
                                    className={inputCls}
                                />
                            </Field>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Placement">
                                    <select
                                        value={draft.placement}
                                        onChange={(e) =>
                                            update('placement', e.target.value as Placement)
                                        }
                                        className={inputCls}
                                    >
                                        <option value="HOME_HERO">Homepage hero</option>
                                        <option value="CATEGORY_HERO">Category hero</option>
                                        <option value="PROMO_STRIP">Promo strip</option>
                                    </select>
                                </Field>
                                <Field label="Slide order">
                                    <input
                                        type="number"
                                        min={1}
                                        value={draft.order}
                                        onChange={(e) =>
                                            update('order', parseInt(e.target.value) || 1)
                                        }
                                        className={inputCls}
                                    />
                                </Field>
                            </div>

                            <Field label="Badge (small label above headline)">
                                <input
                                    value={draft.badge}
                                    onChange={(e) => update('badge', e.target.value)}
                                    placeholder="Visit Our Store • Westlands Nairobi"
                                    className={inputCls}
                                />
                            </Field>

                            <Field label="Headline">
                                <input
                                    value={draft.headline}
                                    onChange={(e) => update('headline', e.target.value)}
                                    placeholder="Experience Tech In Person."
                                    className={inputCls}
                                />
                            </Field>

                            <Field label="Description">
                                <textarea
                                    value={draft.description}
                                    onChange={(e) => update('description', e.target.value)}
                                    rows={3}
                                    placeholder="Walk in, try before you buy…"
                                    className={inputCls + ' resize-none'}
                                />
                            </Field>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Primary CTA text">
                                    <input
                                        value={draft.primary_cta_text}
                                        onChange={(e) => update('primary_cta_text', e.target.value)}
                                        placeholder="Find A Store"
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="Primary CTA link">
                                    <input
                                        value={draft.primary_cta_href}
                                        onChange={(e) => update('primary_cta_href', e.target.value)}
                                        placeholder="/stores"
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="Secondary CTA text">
                                    <input
                                        value={draft.secondary_cta_text}
                                        onChange={(e) =>
                                            update('secondary_cta_text', e.target.value)
                                        }
                                        placeholder="Talk To Us"
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="Secondary CTA link">
                                    <input
                                        value={draft.secondary_cta_href}
                                        onChange={(e) =>
                                            update('secondary_cta_href', e.target.value)
                                        }
                                        placeholder="/support"
                                        className={inputCls}
                                    />
                                </Field>
                            </div>
                        </>
                    )}

                    {tab === 'media' && (
                        <>
                            <ImageDrop
                                label="Desktop image (required)"
                                hint="Recommended 1920×840. Drag & drop or click."
                                value={draft.desktop_image}
                                onChange={(v) => update('desktop_image', v)}
                                maxWidth={1920}
                                aspect="16 / 7"
                            />

                            <ImageDrop
                                label="Tablet image (optional)"
                                hint="Falls back to desktop if empty."
                                value={draft.tablet_image}
                                onChange={(v) => update('tablet_image', v)}
                                maxWidth={1280}
                                aspect="16 / 7"
                            />

                            <ImageDrop
                                label="Mobile image (optional)"
                                hint="Falls back to desktop if empty."
                                value={draft.mobile_image}
                                onChange={(v) => update('mobile_image', v)}
                                maxWidth={828}
                                aspect="4 / 5"
                            />

                            <div className="pt-1">
                                <div className="text-[13px] font-medium text-slate-700 mb-1">
                                    Live preview
                                </div>
                                <div className="relative bg-slate-950 rounded-sm overflow-hidden border border-slate-200 aspect-[16/7]">
                                    <SlideArtFull banner={draft} />
                                </div>
                            </div>
                        </>
                    )}

                    {tab === 'design' && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Text alignment">
                                    <select
                                        value={draft.text_alignment}
                                        onChange={(e) =>
                                            update('text_alignment', e.target.value as Alignment)
                                        }
                                        className={inputCls}
                                    >
                                        <option value="LEFT">Left</option>
                                        <option value="CENTER">Center</option>
                                        <option value="RIGHT">Right</option>
                                    </select>
                                </Field>
                                <Field label="Overlay style">
                                    <select
                                        value={draft.overlay_style}
                                        onChange={(e) =>
                                            update('overlay_style', e.target.value as Overlay)
                                        }
                                        className={inputCls}
                                    >
                                        <option value="NONE">None</option>
                                        <option value="DARK">Dark</option>
                                        <option value="LIGHT">Light</option>
                                        <option value="GRADIENT">Gradient</option>
                                    </select>
                                </Field>
                            </div>

                            <Field label={`Overlay opacity — ${draft.overlay_opacity}%`}>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={draft.overlay_opacity}
                                    onChange={(e) =>
                                        update('overlay_opacity', parseInt(e.target.value))
                                    }
                                    className="w-full accent-blue-950"
                                />
                            </Field>

                            <div className="pt-1">
                                <div className="text-[13px] font-medium text-slate-700 mb-1">
                                    Live preview
                                </div>
                                <div className="relative bg-slate-950 rounded-sm overflow-hidden border border-slate-200 aspect-[16/7]">
                                    <SlideArtFull banner={draft} />
                                </div>
                            </div>
                        </>
                    )}

                    {tab === 'schedule' && (
                        <>
                            <Field label="Status">
                                <select
                                    value={draft.status}
                                    onChange={(e) => update('status', e.target.value as Status)}
                                    className={inputCls}
                                >
                                    <option value="DRAFT">Draft</option>
                                    <option value="ACTIVE">Active</option>
                                    <option value="SCHEDULED">Scheduled</option>
                                    <option value="EXPIRED">Expired</option>
                                </select>
                            </Field>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Start date & time">
                                    <input
                                        type="datetime-local"
                                        value={draft.start_at}
                                        onChange={(e) => update('start_at', e.target.value)}
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="End date & time">
                                    <input
                                        type="datetime-local"
                                        value={draft.end_at}
                                        onChange={(e) => update('end_at', e.target.value)}
                                        className={inputCls}
                                    />
                                </Field>
                            </div>

                            <p className="text-[13px] text-slate-500">
                                Leave end date empty to run indefinitely. Set status to
                                Scheduled to start automatically at the start date.
                            </p>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-slate-200 bg-white shrink-0">
                    <button
                        onClick={onClose}
                        className="text-[13px] text-slate-600 hover:text-slate-900 px-3 py-2"
                    >
                        Cancel
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() =>
                                onSave({
                                    ...draft,
                                    status: 'DRAFT',
                                    updated_at: new Date().toISOString(),
                                })
                            }
                            className="text-[13px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-sm transition"
                        >
                            Save as draft
                        </button>
                        <button
                            onClick={submit}
                            className="text-[13px] font-medium text-white bg-blue-950 hover:bg-blue-900 px-3 py-2 rounded-sm transition"
                        >
                            Save banner
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Image drop
// ─────────────────────────────────────────────────────────────────────────────
async function fileToDataUrl(file: File, maxWidth: number): Promise<string> {
    const raw = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });

    if (
        !file.type.startsWith('image/') ||
        file.type === 'image/svg+xml'
    ) {
        return raw;
    }

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Could not read image'));
        el.src = raw;
    });

    if (img.width <= maxWidth) return raw;

    const scale = maxWidth / img.width;
    const canvas = document.createElement('canvas');
    canvas.width = maxWidth;
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return raw;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.88);
}

function ImageDrop({
    label,
    hint,
    value,
    onChange,
    maxWidth,
    aspect,
}: {
    label: string;
    hint?: string;
    value: string;
    onChange: (dataUrl: string) => void;
    maxWidth: number;
    aspect?: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const handleFiles = useCallback(
        async (files: FileList | null) => {
            setError('');
            const file = files?.[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                setError('Please choose an image file.');
                return;
            }
            if (file.size > 15 * 1024 * 1024) {
                setError('Image is too large (max 15 MB).');
                return;
            }
            setBusy(true);
            try {
                const dataUrl = await fileToDataUrl(file, maxWidth);
                onChange(dataUrl);
            } catch {
                setError('Could not read that image. Try another file.');
            } finally {
                setBusy(false);
            }
        },
        [maxWidth, onChange],
    );

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <label className="block text-[13px] font-medium text-slate-700">
                    {label}
                </label>
                {value && (
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        className="text-[11px] text-slate-500 hover:text-rose-600"
                    >
                        Remove
                    </button>
                )}
            </div>

            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    void handleFiles(e.dataTransfer.files);
                }}
                onClick={() => inputRef.current?.click()}
                className={`group relative cursor-pointer rounded-sm border-2 border-dashed transition ${dragging
                    ? 'border-blue-950 bg-blue-50/40'
                    : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                    }`}
            >
                {value ? (
                    <div
                        className="relative w-full overflow-hidden rounded-sm"
                        style={aspect ? { aspectRatio: aspect } : undefined}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={value} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/40 transition flex items-center justify-center">
                            <span className="text-white text-[12px] font-medium opacity-0 group-hover:opacity-100 transition">
                                Click to replace
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
                        {busy ? (
                            <svg
                                className="animate-spin w-5 h-5 text-slate-400 mb-2"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                            </svg>
                        ) : (
                            <svg
                                className="w-5 h-5 text-slate-400 mb-2"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                            </svg>
                        )}
                        <p className="text-[13px] text-slate-600 font-medium">
                            {busy ? 'Processing…' : 'Click to upload or drag & drop'}
                        </p>
                        {hint && (
                            <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>
                        )}
                    </div>
                )}
            </div>

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleFiles(e.target.files)}
            />

            {error && <p className="text-[11px] text-rose-600">{error}</p>}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Field wrapper
// ─────────────────────────────────────────────────────────────────────────────
function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="block text-[13px] font-medium text-slate-700 mb-1">
                {label}
            </span>
            {children}
        </label>
    );
}