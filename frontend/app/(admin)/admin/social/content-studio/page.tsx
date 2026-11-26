
'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    AlertTriangle,
    ArrowLeft,
    CalendarDays,
    Check,
    CheckCircle2,
    Copy,
    Eye,
    FileText,
    Grid3x3,
    Image as ImageIcon,
    Layers,
    LayoutList,
    Loader2,
    MessageSquare,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    Send,
    Sparkles,
    Trash2,
    Upload,
    X,
    XCircle,
    type LucideIcon,
} from 'lucide-react';
import { type IconType } from 'react-icons';
import { FaFacebook, FaInstagram, FaTiktok, FaYoutube } from 'react-icons/fa';
import { adminApi as api } from '@/lib/admin-api';
import { ApiError, type Me } from '@/lib/api';

type PlatformKey = 'youtube' | 'facebook' | 'instagram' | 'tiktok';

type ContentType = 'image' | 'video' | 'reel' | 'short' | 'story' | 'text' | 'thumbnail' | 'creative';

type ContentStatus =
    | 'draft'
    | 'in_review'
    | 'changes_requested'
    | 'approved'
    | 'rejected'
    | 'ready_to_schedule'
    | 'scheduled'
    | 'published'
    | 'failed'
    | 'archived';

type MediaAsset = {
    id: string;
    kind: 'image' | 'video';
    url: string;
    thumbnail_url?: string | null;
    name?: string | null;
    mime_type?: string | null;
    width?: number | null;
    height?: number | null;
    duration_seconds?: number | null;
    size_bytes?: number | null;
    source?: 'upload' | 'library' | string | null;
};

type LinkedProduct = {
    id: string;
    name: string;
    image_url?: string | null;
    sku?: string | null;
    price?: number | null;
    currency?: string | null;
    in_stock?: boolean | null;
    url?: string | null;
};

type PlatformConfig = {
    platform: PlatformKey;
    youtube_title?: string | null;
    youtube_description?: string | null;
    youtube_tags?: string[] | null;
    youtube_visibility?: 'public' | 'unlisted' | 'private' | null;
    youtube_thumbnail_asset_id?: string | null;
    facebook_post_text?: string | null;
    facebook_link_url?: string | null;
    facebook_reel?: boolean | null;
    instagram_caption?: string | null;
    instagram_format?: 'post' | 'reel' | 'story' | null;
    instagram_cover_asset_id?: string | null;
    instagram_hashtags?: string[] | null;
    tiktok_caption?: string | null;
    tiktok_photo_post?: boolean | null;
    tiktok_privacy?: 'public' | 'friends' | 'private' | null;
    tiktok_comments_enabled?: boolean | null;
    tiktok_duet_enabled?: boolean | null;
    tiktok_stitch_enabled?: boolean | null;
    tiktok_commercial_disclosure?: boolean | null;
};

type ApprovalEntry = {
    at: string;
    actor_name?: string | null;
    action: 'submitted' | 'approved' | 'rejected' | 'changes_requested' | 'scheduled' | 'published' | 'archived' | string;
    reason?: string | null;
};

type ContentDraft = {
    id: string;
    title: string;
    caption?: string | null;
    description?: string | null;
    internal_notes?: string | null;
    content_type: ContentType;
    category?: string | null;
    campaign_id?: string | null;
    campaign_name?: string | null;
    owner_id?: string | null;
    owner_name?: string | null;
    media: MediaAsset[];
    platforms: PlatformKey[];
    platform_configs: Partial<Record<PlatformKey, PlatformConfig>>;
    products: LinkedProduct[];
    status: ContentStatus;
    created_at?: string | null;
    updated_at?: string | null;
    approval_history?: ApprovalEntry[];
    rejection_reason?: string | null;
};

type AccountCapability = {
    platform: PlatformKey;
    can_publish: boolean;
    publishing_formats?: string[];
    publishing_restrictions?: string[];
    status: string;
};

type Campaign = { id: string; name: string };
type StaffMember = { id: string; name: string };
type Category = { id: string; name: string };

type ListPayload = {
    items: ContentDraft[];
    total?: number;
};

const PLATFORM_META: Record<
    PlatformKey,
    {
        label: string;
        icon: IconType;
        brand: string;
        supports: ContentType[];
        maxCaption?: number;
    }
> = {
    youtube: {
        label: 'YouTube',
        icon: FaYoutube,
        brand: 'text-rose-600 bg-rose-50',
        supports: ['video', 'short'],
        maxCaption: 5000,
    },
    facebook: {
        label: 'Facebook',
        icon: FaFacebook,
        brand: 'text-blue-700 bg-blue-50',
        supports: ['image', 'video', 'text', 'reel'],
        maxCaption: 63206,
    },
    instagram: {
        label: 'Instagram',
        icon: FaInstagram,
        brand: 'text-pink-600 bg-pink-50',
        supports: ['image', 'video', 'reel', 'story'],
        maxCaption: 2200,
    },
    tiktok: {
        label: 'TikTok',
        icon: FaTiktok,
        brand: 'text-slate-900 bg-slate-100',
        supports: ['video', 'reel'],
        maxCaption: 2200,
    },
};

const PLATFORM_ORDER: PlatformKey[] = ['youtube', 'facebook', 'instagram', 'tiktok'];

const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
    image: 'Image',
    video: 'Video',
    reel: 'Reel',
    short: 'Short',
    story: 'Story',
    text: 'Text post',
    thumbnail: 'Thumbnail',
    creative: 'Promotional creative',
};

const STATUS_META: Record<ContentStatus, { label: string; chip: string; dot: string }> = {
    draft: { label: 'Draft', chip: 'bg-slate-50 border-slate-200 text-slate-600', dot: 'bg-slate-400' },
    in_review: { label: 'In review', chip: 'bg-blue-50 border-blue-200 text-blue-700', dot: 'bg-blue-500' },
    changes_requested: { label: 'Changes requested', chip: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-500' },
    approved: { label: 'Approved', chip: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500' },
    rejected: { label: 'Rejected', chip: 'bg-rose-50 border-rose-200 text-rose-700', dot: 'bg-rose-500' },
    ready_to_schedule: { label: 'Ready to schedule', chip: 'bg-indigo-50 border-indigo-200 text-indigo-700', dot: 'bg-indigo-500' },
    scheduled: { label: 'Scheduled', chip: 'bg-purple-50 border-purple-200 text-purple-700', dot: 'bg-purple-500' },
    published: { label: 'Published', chip: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500' },
    failed: { label: 'Failed', chip: 'bg-rose-50 border-rose-200 text-rose-700', dot: 'bg-rose-500' },
    archived: { label: 'Archived', chip: 'bg-slate-100 border-slate-200 text-slate-500', dot: 'bg-slate-400' },
};

function detailOf(err: ApiError): string | null {
    if (typeof err.data === 'object' && err.data && 'detail' in err.data) {
        const d = (err.data as { detail: unknown }).detail;
        if (typeof d === 'string') return d;
    }
    return null;
}

function fmtMoney(n: number | null | undefined, currency?: string | null): string {
    if (n === null || n === undefined) return '—';
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: currency || 'KES',
            maximumFractionDigits: 2,
        }).format(n);
    } catch {
        return n.toLocaleString();
    }
}

function formatRelative(iso: string | null | undefined): string {
    if (!iso) return '—';
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return '—';
    const diff = Date.now() - t;
    if (diff < 0) return 'Scheduled';
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function blankConfig(platform: PlatformKey): PlatformConfig {
    if (platform === 'youtube') return { platform, youtube_visibility: 'public' };
    if (platform === 'facebook') return { platform, facebook_reel: false };
    if (platform === 'instagram') return { platform, instagram_format: 'post' };
    return { platform, tiktok_privacy: 'public', tiktok_comments_enabled: true };
}

function emptyDraft(): ContentDraft {
    return {
        id: '',
        title: '',
        caption: '',
        description: '',
        internal_notes: '',
        content_type: 'image',
        media: [],
        platforms: [],
        platform_configs: {},
        products: [],
        status: 'draft',
    };
}

type ApiWithContentStudio = {
    social?: {
        content?: {
            list?: (q: Record<string, unknown>) => Promise<ListPayload>;
            detail?: (id: string) => Promise<ContentDraft>;
            save?: (draft: ContentDraft) => Promise<ContentDraft>;
            remove?: (id: string) => Promise<void>;
            duplicate?: (id: string) => Promise<ContentDraft>;
            submitForApproval?: (id: string) => Promise<ContentDraft>;
            approve?: (id: string) => Promise<ContentDraft>;
            reject?: (id: string, reason: string) => Promise<ContentDraft>;
            requestChanges?: (id: string, reason: string) => Promise<ContentDraft>;
            schedule?: (id: string, scheduled_at: string) => Promise<ContentDraft>;
            publishNow?: (id: string) => Promise<ContentDraft>;
            suggest?: (q: { field: string; context: string; platform?: PlatformKey }) => Promise<{ suggestions: string[] }>;
            categories?: { list?: () => Promise<{ categories: Category[] }> };
        };
        media?: {
            library?: (q?: { q?: string; kind?: 'image' | 'video' }) => Promise<{ assets: MediaAsset[] }>;
            upload?: (file: File) => Promise<MediaAsset>;
        };
        accounts?: {
            list?: () => Promise<{
                accounts: Array<{
                    platform: PlatformKey;
                    status: string;
                    publishing_formats?: string[];
                    publishing_restrictions?: string[];
                }>;
            }>;
        };
        campaigns?: {
            options?: () => Promise<{ campaigns: Campaign[] }>;
        };
    };
    listSocialContent?: (q: Record<string, unknown>) => Promise<ListPayload>;
    getSocialContent?: (id: string) => Promise<ContentDraft>;
    saveSocialContent?: (draft: ContentDraft) => Promise<ContentDraft>;
    deleteSocialContent?: (id: string) => Promise<void>;
    duplicateSocialContent?: (id: string) => Promise<ContentDraft>;
    submitSocialContentForApproval?: (id: string) => Promise<ContentDraft>;
    approveSocialContent?: (id: string) => Promise<ContentDraft>;
    rejectSocialContent?: (id: string, reason: string) => Promise<ContentDraft>;
    requestSocialContentChanges?: (id: string, reason: string) => Promise<ContentDraft>;
    scheduleSocialContent?: (id: string, scheduled_at: string) => Promise<ContentDraft>;
    publishSocialContentNow?: (id: string) => Promise<ContentDraft>;
    getSocialAccounts?: () => Promise<{
        accounts: Array<{
            platform: PlatformKey;
            status: string;
            publishing_formats?: string[];
            publishing_restrictions?: string[];
        }>;
    }>;
    listCampaigns?: () => Promise<{ campaigns: Campaign[] }>;
    listStaff?: () => Promise<StaffMember[] | { staff?: StaffMember[]; results?: StaffMember[] }>;
    listContentCategories?: () => Promise<{ categories: Category[] }>;
    listMediaLibrary?: (q?: { q?: string; kind?: 'image' | 'video' }) => Promise<{ assets: MediaAsset[] }>;
    uploadMedia?: (file: File) => Promise<MediaAsset>;
    searchProducts?: (q: string) => Promise<LinkedProduct[] | { products?: LinkedProduct[]; results?: LinkedProduct[] }>;
    suggestContent?: (q: {
        field: 'caption' | 'hashtags' | 'description' | 'cta' | 'ideas' | 'variation';
        context: string;
        platform?: PlatformKey;
    }) => Promise<{ suggestions: string[] }>;
};

const clientApi = () => api as unknown as ApiWithContentStudio;

async function listContentRequest(q: Record<string, unknown>): Promise<ListPayload> {
    const c = clientApi();
    if (typeof c.social?.content?.list === 'function') return c.social.content.list(q);
    if (typeof c.listSocialContent === 'function') return c.listSocialContent(q);
    throw new Error('Content list endpoint is not available.');
}

async function getContentRequest(id: string): Promise<ContentDraft> {
    const c = clientApi();
    if (typeof c.social?.content?.detail === 'function') return c.social.content.detail(id);
    if (typeof c.getSocialContent === 'function') return c.getSocialContent(id);
    throw new Error('Content item endpoint is not available.');
}

async function saveContentRequest(draft: ContentDraft): Promise<ContentDraft> {
    const c = clientApi();
    if (typeof c.social?.content?.save === 'function') return c.social.content.save(draft);
    if (typeof c.saveSocialContent === 'function') return c.saveSocialContent(draft);
    throw new Error('Save endpoint is not available.');
}

async function deleteContentRequest(id: string): Promise<void> {
    const c = clientApi();
    if (typeof c.social?.content?.remove === 'function') return c.social.content.remove(id);
    if (typeof c.deleteSocialContent === 'function') return c.deleteSocialContent(id);
    throw new Error('Delete endpoint is not available.');
}

async function duplicateContentRequest(id: string): Promise<ContentDraft> {
    const c = clientApi();
    if (typeof c.social?.content?.duplicate === 'function') return c.social.content.duplicate(id);
    if (typeof c.duplicateSocialContent === 'function') return c.duplicateSocialContent(id);
    throw new Error('Duplicate endpoint is not available.');
}

async function submitApprovalRequest(id: string): Promise<ContentDraft> {
    const c = clientApi();
    if (typeof c.social?.content?.submitForApproval === 'function') return c.social.content.submitForApproval(id);
    if (typeof c.submitSocialContentForApproval === 'function') return c.submitSocialContentForApproval(id);
    throw new Error('Submit for approval endpoint is not available.');
}

async function approveContentRequest(id: string): Promise<ContentDraft> {
    const c = clientApi();
    if (typeof c.social?.content?.approve === 'function') return c.social.content.approve(id);
    if (typeof c.approveSocialContent === 'function') return c.approveSocialContent(id);
    throw new Error('Approve endpoint is not available.');
}

async function rejectContentRequest(id: string, reason: string): Promise<ContentDraft> {
    const c = clientApi();
    if (typeof c.social?.content?.reject === 'function') return c.social.content.reject(id, reason);
    if (typeof c.rejectSocialContent === 'function') return c.rejectSocialContent(id, reason);
    throw new Error('Reject endpoint is not available.');
}

async function requestChangesRequest(id: string, reason: string): Promise<ContentDraft> {
    const c = clientApi();
    if (typeof c.social?.content?.requestChanges === 'function') return c.social.content.requestChanges(id, reason);
    if (typeof c.requestSocialContentChanges === 'function') return c.requestSocialContentChanges(id, reason);
    throw new Error('Request changes endpoint is not available.');
}

async function scheduleContentRequest(id: string, scheduled_at: string): Promise<ContentDraft> {
    const c = clientApi();
    if (typeof c.social?.content?.schedule === 'function') return c.social.content.schedule(id, scheduled_at);
    if (typeof c.scheduleSocialContent === 'function') return c.scheduleSocialContent(id, scheduled_at);
    throw new Error('Schedule endpoint is not available.');
}

async function publishNowContentRequest(id: string): Promise<ContentDraft> {
    const c = clientApi();
    if (typeof c.social?.content?.publishNow === 'function') return c.social.content.publishNow(id);
    if (typeof c.publishSocialContentNow === 'function') return c.publishSocialContentNow(id);
    throw new Error('Publish endpoint is not available.');
}

async function listMediaLibraryRequest(q: { q?: string; kind?: 'image' | 'video' }): Promise<{ assets: MediaAsset[] }> {
    const c = clientApi();
    if (typeof c.social?.media?.library === 'function') return c.social.media.library(q);
    if (typeof c.listMediaLibrary === 'function') return c.listMediaLibrary(q);
    throw new Error('Media library endpoint is not available.');
}

async function uploadMediaRequest(file: File): Promise<MediaAsset> {
    const c = clientApi();
    if (typeof c.social?.media?.upload === 'function') return c.social.media.upload(file);
    if (typeof c.uploadMedia === 'function') return c.uploadMedia(file);
    throw new Error('Media upload endpoint is not available.');
}

async function searchProductsRequest(q: string): Promise<LinkedProduct[]> {
    const c = clientApi();
    if (typeof c.searchProducts === 'function') {
        const res = await c.searchProducts(q);
        if (Array.isArray(res)) return res;
        return res.products ?? res.results ?? [];
    }
    throw new Error('Product search endpoint is not available.');
}

async function suggestContentRequest(q: {
    field: 'caption' | 'hashtags' | 'description' | 'cta' | 'ideas' | 'variation';
    context: string;
    platform?: PlatformKey;
}): Promise<{ suggestions: string[] }> {
    const c = clientApi();
    if (typeof c.social?.content?.suggest === 'function') return c.social.content.suggest(q);
    if (typeof c.suggestContent === 'function') return c.suggestContent(q);
    throw new Error('AI suggestions endpoint is not available.');
}

function StatusBadge({ status }: { status: ContentStatus }) {
    const sm = STATUS_META[status];
    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] ${sm.chip}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
            {sm.label}
        </span>
    );
}

function Spinner({ className = 'w-3.5 h-3.5' }: { className?: string }) {
    return <Loader2 className={`animate-spin ${className}`} />;
}

function ContentCard({
    item,
    selected,
    onSelect,
    onOpen,
    onDuplicate,
    onDelete,
    canEdit,
}: {
    item: ContentDraft;
    selected: boolean;
    onSelect: () => void;
    onOpen: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    canEdit: boolean;
}) {
    const firstMedia = item.media[0];
    return (
        <div className={`bg-white border rounded overflow-hidden transition ${selected ? 'border-blue-950 ring-1 ring-blue-950/20' : 'border-slate-200'}`}>
            <div className="relative aspect-video bg-slate-100">
                {firstMedia?.kind === 'video' && firstMedia.thumbnail_url ? (
                    <img src={firstMedia.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : firstMedia?.kind === 'image' ? (
                    <img src={firstMedia.url} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <FileText className="w-6 h-6" />
                    </div>
                )}
                <label className="absolute top-1.5 left-1.5 bg-white/90 rounded p-0.5 shadow-sm">
                    <input type="checkbox" checked={selected} onChange={onSelect} className="accent-blue-950" />
                </label>
                <span className="absolute top-1.5 right-1.5">
                    <StatusBadge status={item.status} />
                </span>
            </div>
            <div className="p-2.5 space-y-1.5">
                <button type="button" onClick={onOpen} className="block w-full text-left">
                    <div className="text-[12px] font-medium text-slate-900 truncate">{item.title || 'Untitled'}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                        {CONTENT_TYPE_LABEL[item.content_type]}
                        {item.campaign_name ? ` · ${item.campaign_name}` : ''}
                    </div>
                </button>
                <div className="flex items-center gap-1 flex-wrap">
                    {item.platforms.map((p) => {
                        const pm = PLATFORM_META[p];
                        const Icon = pm.icon;
                        return (
                            <span key={p} className={`inline-flex items-center justify-center w-5 h-5 rounded ${pm.brand}`} title={pm.label}>
                                <Icon className="w-3 h-3" />
                            </span>
                        );
                    })}
                    {item.products.length > 0 && (
                        <span className="text-[10px] text-slate-500 inline-flex items-center gap-0.5">
                            <Layers className="w-3 h-3" /> {item.products.length}
                        </span>
                    )}
                </div>
                <div className="flex items-center justify-between gap-1 pt-0.5 text-[10px] text-slate-400">
                    <span>Edited {formatRelative(item.updated_at)}</span>
                    <div className="flex items-center gap-0.5">
                        <button type="button" onClick={onDuplicate} disabled={!canEdit} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40" title="Duplicate">
                            <Copy className="w-3 h-3" />
                        </button>
                        <button type="button" onClick={onDelete} disabled={!canEdit} className="p-1 rounded hover:bg-rose-50 text-rose-600 disabled:opacity-40" title="Delete">
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MediaPicker({
    open,
    onClose,
    onPick,
}: {
    open: boolean;
    onClose: () => void;
    onPick: (assets: MediaAsset[]) => void;
}) {
    const [tab, setTab] = useState<'library' | 'upload'>('library');
    const [q, setQ] = useState('');
    const [kind, setKind] = useState<'image' | 'video'>('image');
    const [assets, setAssets] = useState<MediaAsset[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (!open) {
            setPicked(new Set());
            setError(null);
        }
    }, [open]);

    const loadLibrary = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await listMediaLibraryRequest({ q, kind });
            setAssets(res.assets ?? []);
        } catch (err: any) {
            if (err instanceof ApiError) setError(detailOf(err) ?? 'Could not load media library.');
            else if (err instanceof Error) setError(err.message);
            else setError('Could not load media library.');
            setAssets(null);
        } finally {
            setLoading(false);
        }
    }, [q, kind]);

    useEffect(() => {
        if (open && tab === 'library') void loadLibrary();
    }, [open, tab, loadLibrary]);

    const handleUpload = async (file: File) => {
        setUploading(true);
        setError(null);
        try {
            const asset = await uploadMediaRequest(file);
            onPick([asset]);
            onClose();
        } catch (err: any) {
            if (err instanceof ApiError) setError(detailOf(err) ?? 'Upload failed.');
            else if (err instanceof Error) setError(err.message);
            else setError('Upload failed.');
        } finally {
            setUploading(false);
        }
    };

    if (!open) return null;

    const toggle = (id: string) => {
        setPicked((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
        });
    };

    const confirmPick = () => {
        const list = (assets ?? []).filter((a) => picked.has(a.id));
        onPick(list);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-3">
            <div className="w-full max-w-2xl bg-white border border-slate-200 rounded shadow-xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setTab('library')}
                            className={`px-2 py-1 rounded text-[12px] ${tab === 'library' ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            Media Library
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('upload')}
                            className={`px-2 py-1 rounded text-[12px] ${tab === 'upload' ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            Upload new
                        </button>
                    </div>
                    <button type="button" onClick={onClose} className="w-7 h-7 rounded hover:bg-slate-100 text-slate-500 flex items-center justify-center" aria-label="Close">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-3 flex-1 overflow-y-auto space-y-3">
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded px-2.5 py-2 text-[12px] text-rose-700">
                            {error}
                        </div>
                    )}

                    {tab === 'library' && (
                        <>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
                                    <Search className="w-3.5 h-3.5 text-slate-400" />
                                    <input
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                        placeholder="Search media"
                                        className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-950/20"
                                    />
                                </div>
                                <select
                                    value={kind}
                                    onChange={(e) => setKind(e.target.value as 'image' | 'video')}
                                    className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-700"
                                >
                                    <option value="image">Images</option>
                                    <option value="video">Videos</option>
                                </select>
                            </div>

                            {loading ? (
                                <div className="flex items-center gap-2 py-4 text-slate-500 text-[12px]">
                                    <Spinner /> Loading media…
                                </div>
                            ) : !assets?.length ? (
                                <div className="text-center py-6 text-[12px] text-slate-500">
                                    No media found. Upload a new file or adjust your search.
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {assets.map((a) => {
                                        const active = picked.has(a.id);
                                        const thumb = a.kind === 'video' ? a.thumbnail_url : a.url;
                                        return (
                                            <button
                                                key={a.id}
                                                type="button"
                                                onClick={() => toggle(a.id)}
                                                className={`relative aspect-square rounded overflow-hidden border ${active ? 'border-blue-950 ring-2 ring-blue-950/30' : 'border-slate-200'}`}
                                                title={a.name ?? ''}
                                            >
                                                {thumb ? (
                                                    <img src={thumb} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50">
                                                        <ImageIcon className="w-5 h-5" />
                                                    </div>
                                                )}
                                                {active && (
                                                    <span className="absolute top-1 right-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-950 text-white">
                                                        <Check className="w-2.5 h-2.5" />
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {tab === 'upload' && (
                        <label className="block border-2 border-dashed border-slate-200 hover:border-blue-950/40 rounded p-6 text-center cursor-pointer">
                            <input
                                type="file"
                                accept="image/*,video/*"
                                className="hidden"
                                disabled={uploading}
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void handleUpload(f);
                                }}
                            />
                            <div className="text-slate-500">
                                {uploading ? (
                                    <div className="flex items-center justify-center gap-1.5 text-[12px]">
                                        <Spinner /> Uploading…
                                    </div>
                                ) : (
                                    <>
                                        <Upload className="w-6 h-6 mx-auto text-slate-400" />
                                        <p className="mt-1.5 text-[12px] font-medium text-slate-700">Click to upload a file</p>
                                        <p className="text-[11px]">Images or videos. Reused from Media Library when possible.</p>
                                    </>
                                )}
                            </div>
                        </label>
                    )}
                </div>

                {tab === 'library' && (
                    <div className="border-t border-slate-100 px-3 py-2 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">{picked.size} selected</span>
                        <div className="flex items-center gap-1.5">
                            <button type="button" onClick={onClose} className="px-2.5 py-1.5 rounded border border-slate-200 bg-white text-[12px] text-slate-700">
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmPick}
                                disabled={picked.size === 0}
                                className="px-2.5 py-1.5 rounded bg-blue-950 text-white text-[12px] font-medium disabled:opacity-50"
                            >
                                Add {picked.size || ''}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ProductPicker({
    open,
    onClose,
    onPick,
}: {
    open: boolean;
    onClose: () => void;
    onPick: (p: LinkedProduct) => void;
}) {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<LinkedProduct[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) { setQ(''); setResults(null); setError(null); }
    }, [open]);

    const search = async () => {
        setLoading(true);
        setError(null);
        try {
            const list = await searchProductsRequest(q);
            setResults(list);
        } catch (err: any) {
            if (err instanceof ApiError) setError(detailOf(err) ?? 'Search failed.');
            else if (err instanceof Error) setError(err.message);
            else setError('Search failed.');
            setResults(null);
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-3">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded shadow-xl max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100">
                    <h3 className="text-[13px] font-semibold text-slate-900">Link a product</h3>
                    <button type="button" onClick={onClose} className="w-7 h-7 rounded hover:bg-slate-100 text-slate-500 flex items-center justify-center" aria-label="Close">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-3 border-b border-slate-100">
                    <form
                        onSubmit={(e) => { e.preventDefault(); void search(); }}
                        className="flex items-center gap-1.5"
                    >
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search by name or SKU"
                            className="flex-1 bg-white border border-slate-200 rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-950/20"
                        />
                        <button type="submit" className="px-2.5 py-1.5 rounded bg-blue-950 text-white text-[12px] font-medium">Search</button>
                    </form>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded px-2.5 py-2 text-[12px] text-rose-700 mb-2">{error}</div>
                    )}
                    {loading && (
                        <div className="flex items-center gap-2 text-[12px] text-slate-500 py-4"><Spinner /> Searching…</div>
                    )}
                    {!loading && results && results.length === 0 && (
                        <div className="text-center text-[12px] text-slate-500 py-6">No products match your search.</div>
                    )}
                    {!loading && results && results.length > 0 && (
                        <ul className="divide-y divide-slate-100">
                            {results.map((p) => (
                                <li key={p.id} className="py-2 flex items-center gap-2.5 first:pt-0">
                                    <div className="w-10 h-10 rounded bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                                        {p.image_url ? (
                                            <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <Layers className="w-4 h-4 text-slate-400" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[12px] font-medium text-slate-900 truncate">{p.name}</div>
                                        <div className="text-[11px] text-slate-500 truncate">
                                            {p.sku ? `SKU ${p.sku}` : '—'}
                                            {' · '}
                                            {fmtMoney(p.price, p.currency)}
                                            {p.in_stock === false && (
                                                <span className="ml-1 inline-flex items-center gap-0.5 text-rose-600">
                                                    <AlertTriangle className="w-3 h-3" /> Out of stock
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { onPick(p); onClose(); }}
                                        className="shrink-0 px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700"
                                    >
                                        Link
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

function useSuggest() {
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const suggest = async (
        field: 'caption' | 'hashtags' | 'description' | 'cta' | 'ideas' | 'variation',
        context: string,
        platform?: PlatformKey,
    ): Promise<string[] | null> => {
        setLoading(field);
        setError(null);
        try {
            const res = await suggestContentRequest({ field, context, platform });
            return res.suggestions ?? [];
        } catch (err: any) {
            if (err instanceof ApiError) setError(detailOf(err) ?? 'Could not get suggestions.');
            else if (err instanceof Error) setError(err.message);
            else setError('Could not get suggestions.');
            return null;
        } finally {
            setLoading(null);
        }
    };

    return { suggest, loading, error };
}

function PlatformPreview({
    draft,
    platform,
}: {
    draft: ContentDraft;
    platform: PlatformKey;
}) {
    const meta = PLATFORM_META[platform];
    const Icon = meta.icon;
    const cfg = draft.platform_configs[platform] ?? blankConfig(platform);
    const media = draft.media[0];
    const caption =
        platform === 'youtube' ? cfg.youtube_description ?? draft.caption ?? ''
            : platform === 'facebook' ? cfg.facebook_post_text ?? draft.caption ?? ''
                : platform === 'instagram' ? cfg.instagram_caption ?? draft.caption ?? ''
                    : cfg.tiktok_caption ?? draft.caption ?? '';
    const title =
        platform === 'youtube' ? cfg.youtube_title ?? draft.title ?? ''
            : draft.title ?? '';

    return (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border-b border-slate-100">
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded ${meta.brand}`}>
                    <Icon className="w-3 h-3" />
                </span>
                <span className="text-[11px] text-slate-700 font-medium">{meta.label} preview</span>
                <span className="ml-auto text-[10px] text-slate-400">Approximate</span>
            </div>
            <div className="p-2.5 space-y-2">
                <div className="aspect-video bg-slate-100 rounded overflow-hidden flex items-center justify-center">
                    {media?.kind === 'image' ? (
                        <img src={media.url} alt="" className="w-full h-full object-cover" />
                    ) : media?.kind === 'video' && media.thumbnail_url ? (
                        <img src={media.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <ImageIcon className="w-6 h-6 text-slate-400" />
                    )}
                </div>
                {title && <div className="text-[12px] font-semibold text-slate-900 line-clamp-2">{title}</div>}
                <p className="text-[11px] text-slate-600 line-clamp-3 whitespace-pre-wrap">
                    {caption || <span className="text-slate-400">No caption yet</span>}
                </p>
                {platform === 'instagram' && cfg.instagram_hashtags?.length ? (
                    <div className="text-[11px] text-blue-700 truncate">
                        {cfg.instagram_hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
                    </div>
                ) : null}
                {draft.products.length > 0 && (
                    <div className="text-[10px] text-slate-500 border-t border-slate-100 pt-1.5">
                        {draft.products.length} product{draft.products.length > 1 ? 's' : ''} linked
                    </div>
                )}
            </div>
        </div>
    );
}

type EditorTab = 'general' | 'media' | 'platforms' | 'products' | 'preview' | 'approval';

function Field({
    label,
    value,
    onChange,
    disabled,
    placeholder,
    textarea,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
    placeholder?: string;
    textarea?: boolean;
}) {
    return (
        <div className="space-y-1">
            <label className="block text-[12px] font-medium text-slate-700">{label}</label>
            {textarea ? (
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    placeholder={placeholder}
                    rows={3}
                    className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40 disabled:bg-slate-100"
                />
            ) : (
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    placeholder={placeholder}
                    className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40 disabled:bg-slate-100"
                />
            )}
        </div>
    );
}

function ContentEditor({
    draft,
    capabilities,
    campaigns,
    staff,
    categories,
    me,
    canEdit,
    canApprove,
    onSaved,
    onDeleted,
    onClose,
}: {
    draft: ContentDraft;
    capabilities: AccountCapability[];
    campaigns: Campaign[];
    staff: StaffMember[];
    categories: Category[];
    me: Me | null;
    canEdit: boolean;
    canApprove: boolean;
    onSaved: (d: ContentDraft) => void;
    onDeleted: (id: string) => void;
    onClose: () => void;
}) {
    const [model, setModel] = useState<ContentDraft>(draft);
    const [tab, setTab] = useState<EditorTab>('general');
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
    const [productPickerOpen, setProductPickerOpen] = useState(false);
    const [rejectOpen, setRejectOpen] = useState<'reject' | 'changes' | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [scheduleAt, setScheduleAt] = useState('');
    const [previewPlatform, setPreviewPlatform] = useState<PlatformKey>('instagram');

    const ai = useSuggest();

    useEffect(() => {
        setModel(draft);
        setTab('general');
        setError(null);
        setNotice(null);
    }, [draft.id]);

    const isNew = !model.id;
    const patch = (p: Partial<ContentDraft>) => setModel((m) => ({ ...m, ...p }));

    const togglePlatform = (p: PlatformKey) => {
        setModel((m) => {
            const has = m.platforms.includes(p);
            const platforms = has ? m.platforms.filter((x) => x !== p) : [...m.platforms, p];
            const platform_configs = { ...m.platform_configs };
            if (!has && !platform_configs[p]) platform_configs[p] = blankConfig(p);
            if (has) delete platform_configs[p];
            return { ...m, platforms, platform_configs };
        });
        if (!model.platforms.includes(p)) setPreviewPlatform(p);
    };

    const setPlatformField = <K extends keyof PlatformConfig>(p: PlatformKey, k: K, v: PlatformConfig[K]) => {
        setModel((m) => ({
            ...m,
            platform_configs: {
                ...m.platform_configs,
                [p]: { ...(m.platform_configs[p] ?? blankConfig(p)), [k]: v },
            },
        }));
    };

    const capabilityFor = (p: PlatformKey) => capabilities.find((c) => c.platform === p) ?? null;

    const canPlatformPublish = (p: PlatformKey) => {
        const cap = capabilityFor(p);
        return !!cap?.can_publish;
    };

    const save = async () => {
        setBusy('save');
        setError(null);
        setNotice(null);
        try {
            const saved = await saveContentRequest(model);
            setModel(saved);
            onSaved(saved);
            setNotice('Saved.');
        } catch (err: any) {
            if (err instanceof ApiError) setError(detailOf(err) ?? 'Save failed.');
            else if (err instanceof Error) setError(err.message);
            else setError('Save failed.');
        } finally {
            setBusy(null);
        }
    };

    const runAction = async (key: string, fn: () => Promise<ContentDraft | void>, after?: (d: ContentDraft) => void) => {
        setBusy(key);
        setError(null);
        setNotice(null);
        try {
            const res = await fn();
            if (res) {
                setModel(res);
                onSaved(res);
                after?.(res);
            }
        } catch (err: any) {
            if (err instanceof ApiError) setError(detailOf(err) ?? 'Action failed.');
            else if (err instanceof Error) setError(err.message);
            else setError('Action failed.');
        } finally {
            setBusy(null);
        }
    };

    const handleDelete = () => {
        if (!model.id) { onClose(); return; }
        void runAction('delete', async () => {
            await deleteContentRequest(model.id);
            onDeleted(model.id);
        });
    };

    const addMedia = (assets: MediaAsset[]) => {
        setModel((m) => ({ ...m, media: [...m.media, ...assets] }));
    };

    const removeMedia = (id: string) => {
        setModel((m) => ({ ...m, media: m.media.filter((a) => a.id !== id) }));
    };

    const addProduct = (p: LinkedProduct) => {
        setModel((m) => (m.products.find((x) => x.id === p.id) ? m : { ...m, products: [...m.products, p] }));
    };

    const removeProduct = (id: string) => {
        setModel((m) => ({ ...m, products: m.products.filter((p) => p.id !== id) }));
    };

    const submitForApproval = () =>
        runAction('submit', () => submitApprovalRequest(model.id), () => setNotice('Submitted for approval.'));

    const approve = () =>
        runAction('approve', () => approveContentRequest(model.id), () => setNotice('Approved.'));

    const confirmReject = () => {
        if (!rejectReason.trim()) return;
        const action = rejectOpen;
        setRejectOpen(null);
        void runAction(
            action ?? 'reject',
            async () => {
                if (action === 'changes') {
                    return requestChangesRequest(model.id, rejectReason.trim());
                }
                return rejectContentRequest(model.id, rejectReason.trim());
            },
            () => {
                setRejectReason('');
                setNotice(action === 'changes' ? 'Changes requested.' : 'Rejected.');
            },
        );
    };

    const schedule = () => {
        if (!scheduleAt) return;
        const iso = new Date(scheduleAt).toISOString();
        void runAction(
            'schedule',
            () => scheduleContentRequest(model.id, iso),
            () => setNotice('Scheduled. Track it in the Publishing Calendar.'),
        );
    };

    const publishNow = () =>
        runAction('publish', () => publishNowContentRequest(model.id), () => setNotice('Publishing initiated.'));

    const tabs: { key: EditorTab; label: string; icon: LucideIcon }[] = [
        { key: 'general', label: 'General', icon: FileText },
        { key: 'media', label: 'Media', icon: ImageIcon },
        { key: 'platforms', label: 'Platforms', icon: Layers },
        { key: 'products', label: 'Products', icon: Grid3x3 },
        { key: 'preview', label: 'Preview', icon: Eye },
        { key: 'approval', label: 'Approval', icon: CheckCircle2 },
    ];

    const canSubmit = !!model.id && canEdit && ['draft', 'changes_requested'].includes(model.status);
    const canApproveNow = !!model.id && canApprove && model.status === 'in_review';
    const canSchedule = !!model.id && canEdit && ['approved', 'ready_to_schedule'].includes(model.status);
    const canPublishNow = !!model.id && canEdit && ['approved', 'ready_to_schedule'].includes(model.status);

    const blockedPlatforms = model.platforms.filter((p) => !canPlatformPublish(p));

    return (
        <div className="bg-white border border-slate-200 rounded">
            <header className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2 min-w-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-7 h-7 rounded hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                        aria-label="Back"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-slate-900 truncate">
                            {isNew ? 'New content' : model.title || 'Untitled'}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <StatusBadge status={model.status} />
                            {model.updated_at && <span>· Updated {formatRelative(model.updated_at)}</span>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {model.id && (
                        <button type="button" onClick={handleDelete} disabled={!canEdit || busy === 'delete'} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white hover:bg-rose-50 text-[11px] text-rose-700 disabled:opacity-50">
                            {busy === 'delete' ? <Spinner /> : <Trash2 className="w-3 h-3" />}
                            Delete
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => void save()}
                        disabled={!canEdit || busy === 'save'}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-blue-950 hover:bg-blue-900 text-white text-[12px] font-medium disabled:opacity-50"
                    >
                        {busy === 'save' ? <Spinner /> : <Check className="w-3.5 h-3.5" />}
                        {isNew ? 'Create draft' : 'Save'}
                    </button>
                </div>
            </header>

            {error && (
                <div className="mx-3 mt-3 bg-rose-50 border border-rose-200 rounded px-2.5 py-2 text-[12px] text-rose-700">{error}</div>
            )}
            {notice && (
                <div className="mx-3 mt-3 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-2 text-[12px] text-emerald-700">{notice}</div>
            )}

            <nav className="px-3 pt-2 overflow-x-auto">
                <ul className="flex items-center gap-1 min-w-max">
                    {tabs.map((t) => (
                        <li key={t.key}>
                            <button
                                type="button"
                                onClick={() => setTab(t.key)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] font-medium border-b-2 transition whitespace-nowrap ${tab === t.key
                                        ? 'text-blue-950 border-blue-950 bg-slate-50'
                                        : 'text-slate-600 border-transparent hover:bg-slate-50'
                                    }`}
                            >
                                <t.icon className="w-3.5 h-3.5" />
                                {t.label}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="p-3 space-y-3">
                {tab === 'general' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Field label="Title" value={model.title} onChange={(v) => patch({ title: v })} disabled={!canEdit} placeholder="Internal title" />
                        <div className="space-y-1">
                            <label className="block text-[12px] font-medium text-slate-700">Content type</label>
                            <select
                                value={model.content_type}
                                onChange={(e) => patch({ content_type: e.target.value as ContentType })}
                                disabled={!canEdit}
                                className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-950/20 disabled:bg-slate-100"
                            >
                                {(Object.keys(CONTENT_TYPE_LABEL) as ContentType[]).map((t) => (
                                    <option key={t} value={t}>{CONTENT_TYPE_LABEL[t]}</option>
                                ))}
                            </select>
                        </div>
                        <Field label="Internal notes" value={model.internal_notes ?? ''} onChange={(v) => patch({ internal_notes: v })} disabled={!canEdit} placeholder="Only visible to staff" textarea />
                        <div className="space-y-1">
                            <label className="block text-[12px] font-medium text-slate-700">Category</label>
                            <select
                                value={model.category ?? ''}
                                onChange={(e) => patch({ category: e.target.value || null })}
                                disabled={!canEdit}
                                className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-950/20 disabled:bg-slate-100"
                            >
                                <option value="">—</option>
                                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="block text-[12px] font-medium text-slate-700">Campaign</label>
                            <select
                                value={model.campaign_id ?? ''}
                                onChange={(e) => patch({ campaign_id: e.target.value || null })}
                                disabled={!canEdit}
                                className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-950/20 disabled:bg-slate-100"
                            >
                                <option value="">—</option>
                                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="block text-[12px] font-medium text-slate-700">Assigned to</label>
                            <select
                                value={model.owner_id ?? ''}
                                onChange={(e) => patch({ owner_id: e.target.value || null })}
                                disabled={!canEdit}
                                className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-950/20 disabled:bg-slate-100"
                            >
                                <option value="">{me?.email ? `Me (${me.email})` : 'Me'}</option>
                                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <Field label="Caption" value={model.caption ?? ''} onChange={(v) => patch({ caption: v })} disabled={!canEdit} placeholder="A shared caption used as a base for each platform" textarea />
                            <div className="mt-1 flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const s = await ai.suggest('caption', model.title || model.caption || '', previewPlatform);
                                        if (s?.[0]) patch({ caption: s[0] });
                                    }}
                                    disabled={!canEdit || ai.loading === 'caption'}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] text-slate-700 disabled:opacity-50"
                                >
                                    {ai.loading === 'caption' ? <Spinner /> : <Sparkles className="w-3 h-3" />}
                                    Suggest caption
                                </button>
                                {ai.error && <span className="text-[11px] text-rose-600">{ai.error}</span>}
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'media' && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-[12px] text-slate-600">Add media from the Media Library or upload new.</p>
                            <button type="button" onClick={() => setMediaPickerOpen(true)} disabled={!canEdit} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] text-slate-700 disabled:opacity-50">
                                <Plus className="w-3 h-3" /> Add media
                            </button>
                        </div>
                        {model.media.length === 0 ? (
                            <div className="border-2 border-dashed border-slate-200 rounded p-6 text-center text-[12px] text-slate-500">
                                No media yet. Add images or videos.
                            </div>
                        ) : (
                            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {model.media.map((m) => (
                                    <li key={m.id} className="relative rounded overflow-hidden border border-slate-200 aspect-square bg-slate-100">
                                        {(m.kind === 'image' ? m.url : m.thumbnail_url) ? (
                                            <img src={m.kind === 'image' ? m.url : (m.thumbnail_url ?? '')} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon className="w-5 h-5" /></div>
                                        )}
                                        {canEdit && (
                                            <button
                                                type="button"
                                                onClick={() => removeMedia(m.id)}
                                                className="absolute top-1 right-1 w-6 h-6 rounded bg-white/90 shadow inline-flex items-center justify-center text-rose-700 hover:bg-white"
                                                aria-label="Remove"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                        <span className="absolute bottom-1 left-1 text-[10px] bg-white/80 rounded px-1 text-slate-600">{m.kind}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {tab === 'platforms' && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {PLATFORM_ORDER.map((p) => {
                                const pm = PLATFORM_META[p];
                                const Icon = pm.icon;
                                const active = model.platforms.includes(p);
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => togglePlatform(p)}
                                        disabled={!canEdit}
                                        className={`flex items-center gap-2 px-2 py-1.5 rounded border text-[12px] transition ${active ? 'border-blue-950 bg-blue-950/5 text-slate-900' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                            } disabled:opacity-50`}
                                    >
                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded ${pm.brand}`}>
                                            <Icon className="w-3.5 h-3.5" />
                                        </span>
                                        <span className="font-medium">{pm.label}</span>
                                        {active && <Check className="w-3 h-3 ml-auto text-blue-950" />}
                                    </button>
                                );
                            })}
                        </div>

                        {blockedPlatforms.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded px-2.5 py-2 text-[12px] text-amber-800 flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                <div>
                                    These platforms cannot publish right now:{' '}
                                    <span className="font-medium">{blockedPlatforms.map((p) => PLATFORM_META[p].label).join(', ')}</span>.
                                    Reauthorize them in Accounts &amp; Channels before scheduling.
                                </div>
                            </div>
                        )}

                        {model.platforms.map((p) => {
                            const pm = PLATFORM_META[p];
                            const Icon = pm.icon;
                            const cfg = model.platform_configs[p] ?? blankConfig(p);
                            return (
                                <div key={p} className="border border-slate-200 rounded">
                                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border-b border-slate-100">
                                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded ${pm.brand}`}><Icon className="w-3 h-3" /></span>
                                        <span className="text-[12px] font-medium text-slate-800">{pm.label} configuration</span>
                                    </div>
                                    <div className="p-2.5 grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {p === 'youtube' && (
                                            <>
                                                <Field label="Video title" value={cfg.youtube_title ?? ''} onChange={(v) => setPlatformField(p, 'youtube_title', v)} disabled={!canEdit} />
                                                <div className="space-y-1">
                                                    <label className="block text-[12px] font-medium text-slate-700">Visibility</label>
                                                    <select value={cfg.youtube_visibility ?? 'public'} onChange={(e) => setPlatformField(p, 'youtube_visibility', e.target.value as 'public' | 'unlisted' | 'private')} disabled={!canEdit} className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] disabled:bg-slate-100">
                                                        <option value="public">Public</option>
                                                        <option value="unlisted">Unlisted</option>
                                                        <option value="private">Private</option>
                                                    </select>
                                                </div>
                                                <Field label="Description" value={cfg.youtube_description ?? ''} onChange={(v) => setPlatformField(p, 'youtube_description', v)} disabled={!canEdit} textarea />
                                                <Field label="Tags (comma separated)" value={(cfg.youtube_tags ?? []).join(', ')} onChange={(v) => setPlatformField(p, 'youtube_tags', v.split(',').map((s) => s.trim()).filter(Boolean))} disabled={!canEdit} />
                                            </>
                                        )}

                                        {p === 'facebook' && (
                                            <>
                                                <Field label="Post text" value={cfg.facebook_post_text ?? ''} onChange={(v) => setPlatformField(p, 'facebook_post_text', v)} disabled={!canEdit} textarea />
                                                <Field label="Link URL" value={cfg.facebook_link_url ?? ''} onChange={(v) => setPlatformField(p, 'facebook_link_url', v)} disabled={!canEdit} placeholder="https://" />
                                                <label className="inline-flex items-center gap-1.5">
                                                    <input type="checkbox" checked={!!cfg.facebook_reel} onChange={(e) => setPlatformField(p, 'facebook_reel', e.target.checked)} disabled={!canEdit} className="accent-blue-950" />
                                                    <span className="text-[12px] text-slate-700">Publish as Reel</span>
                                                </label>
                                            </>
                                        )}

                                        {p === 'instagram' && (
                                            <>
                                                <Field label="Caption" value={cfg.instagram_caption ?? ''} onChange={(v) => setPlatformField(p, 'instagram_caption', v)} disabled={!canEdit} textarea />
                                                <div className="space-y-1">
                                                    <label className="block text-[12px] font-medium text-slate-700">Format</label>
                                                    <select value={cfg.instagram_format ?? 'post'} onChange={(e) => setPlatformField(p, 'instagram_format', e.target.value as 'post' | 'reel' | 'story')} disabled={!canEdit} className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] disabled:bg-slate-100">
                                                        <option value="post">Post</option>
                                                        <option value="reel">Reel</option>
                                                        <option value="story">Story</option>
                                                    </select>
                                                </div>
                                                <Field label="Hashtags" value={(cfg.instagram_hashtags ?? []).join(' ')} onChange={(v) => setPlatformField(p, 'instagram_hashtags', v.split(/\s+/).map((s) => s.replace(/^#/, '')).filter(Boolean))} disabled={!canEdit} placeholder="#sale #newcollection" />
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            const s = await ai.suggest('hashtags', model.caption || model.title || '', p);
                                                            if (s?.length) setPlatformField(p, 'instagram_hashtags', s[0].split(/\s+/).map((x) => x.replace(/^#/, '')).filter(Boolean));
                                                        }}
                                                        disabled={!canEdit || ai.loading === 'hashtags'}
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] text-slate-700 disabled:opacity-50"
                                                    >
                                                        {ai.loading === 'hashtags' ? <Spinner /> : <Sparkles className="w-3 h-3" />}
                                                        Suggest hashtags
                                                    </button>
                                                </div>
                                            </>
                                        )}

                                        {p === 'tiktok' && (
                                            <>
                                                <Field label="Caption" value={cfg.tiktok_caption ?? ''} onChange={(v) => setPlatformField(p, 'tiktok_caption', v)} disabled={!canEdit} textarea />
                                                <div className="space-y-1">
                                                    <label className="block text-[12px] font-medium text-slate-700">Privacy</label>
                                                    <select value={cfg.tiktok_privacy ?? 'public'} onChange={(e) => setPlatformField(p, 'tiktok_privacy', e.target.value as 'public' | 'friends' | 'private')} disabled={!canEdit} className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] disabled:bg-slate-100">
                                                        <option value="public">Public</option>
                                                        <option value="friends">Friends</option>
                                                        <option value="private">Private</option>
                                                    </select>
                                                </div>
                                                <label className="inline-flex items-center gap-1.5">
                                                    <input type="checkbox" checked={!!cfg.tiktok_comments_enabled} onChange={(e) => setPlatformField(p, 'tiktok_comments_enabled', e.target.checked)} disabled={!canEdit} className="accent-blue-950" />
                                                    <span className="text-[12px] text-slate-700">Allow comments</span>
                                                </label>
                                                <label className="inline-flex items-center gap-1.5">
                                                    <input type="checkbox" checked={!!cfg.tiktok_commercial_disclosure} onChange={(e) => setPlatformField(p, 'tiktok_commercial_disclosure', e.target.checked)} disabled={!canEdit} className="accent-blue-950" />
                                                    <span className="text-[12px] text-slate-700">Commercial content disclosure</span>
                                                </label>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {tab === 'products' && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-[12px] text-slate-600">Link existing products so attribution and stock are accurate.</p>
                            <button type="button" onClick={() => setProductPickerOpen(true)} disabled={!canEdit} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] text-slate-700 disabled:opacity-50">
                                <Plus className="w-3 h-3" /> Add product
                            </button>
                        </div>
                        {model.products.length === 0 ? (
                            <div className="border-2 border-dashed border-slate-200 rounded p-6 text-center text-[12px] text-slate-500">
                                No products linked.
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {model.products.map((p) => (
                                    <li key={p.id} className="py-2 flex items-center gap-2.5 first:pt-0 last:pb-0">
                                        <div className="w-10 h-10 rounded bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                                            {p.image_url ? (
                                                <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <Layers className="w-4 h-4 text-slate-400" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[12px] font-medium text-slate-900 truncate">{p.name}</div>
                                            <div className="text-[11px] text-slate-500">
                                                {p.sku ? `SKU ${p.sku} · ` : ''}{fmtMoney(p.price, p.currency)}
                                                {p.in_stock === false && <span className="ml-1 text-rose-600">· Out of stock</span>}
                                            </div>
                                        </div>
                                        {canEdit && (
                                            <button type="button" onClick={() => removeProduct(p.id)} className="shrink-0 p-1 rounded hover:bg-rose-50 text-rose-600" aria-label="Remove">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {model.products.some((p) => p.in_stock === false) && (
                            <div className="bg-amber-50 border border-amber-200 rounded px-2.5 py-2 text-[12px] text-amber-800 flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                One or more linked products are out of stock. Promotion may be inaccurate.
                            </div>
                        )}
                    </div>
                )}

                {tab === 'preview' && (
                    <div className="space-y-2">
                        {model.platforms.length === 0 ? (
                            <div className="border border-slate-200 rounded p-6 text-center text-[12px] text-slate-500">
                                Select platforms on the Platforms tab to see previews.
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {model.platforms.map((p) => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setPreviewPlatform(p)}
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border ${previewPlatform === p ? 'bg-blue-950 text-white border-blue-950' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                                        >
                                            {PLATFORM_META[p].label}
                                        </button>
                                    ))}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {model.platforms.map((p) => (
                                        <PlatformPreview key={p} draft={model} platform={p} />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {tab === 'approval' && (
                    <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                            {canSubmit && (
                                <button type="button" onClick={() => void submitForApproval()} disabled={busy === 'submit'} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[12px] font-medium text-slate-700 disabled:opacity-50">
                                    {busy === 'submit' ? <Spinner /> : <Send className="w-3.5 h-3.5" />} Submit for approval
                                </button>
                            )}
                            {canApproveNow && (
                                <>
                                    <button type="button" onClick={() => void approve()} disabled={busy === 'approve'} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-medium disabled:opacity-50">
                                        {busy === 'approve' ? <Spinner /> : <CheckCircle2 className="w-3.5 h-3.5" />} Approve
                                    </button>
                                    <button type="button" onClick={() => setRejectOpen('changes')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-[12px] font-medium text-amber-800">
                                        <MessageSquare className="w-3.5 h-3.5" /> Request changes
                                    </button>
                                    <button type="button" onClick={() => setRejectOpen('reject')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-rose-300 bg-white hover:bg-rose-50 text-[12px] font-medium text-rose-700">
                                        <XCircle className="w-3.5 h-3.5" /> Reject
                                    </button>
                                </>
                            )}
                        </div>

                        {canSchedule && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <input
                                    type="datetime-local"
                                    value={scheduleAt}
                                    onChange={(e) => setScheduleAt(e.target.value)}
                                    className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px]"
                                />
                                <button type="button" onClick={schedule} disabled={!scheduleAt || busy === 'schedule'} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-blue-950 text-white text-[12px] font-medium disabled:opacity-50">
                                    {busy === 'schedule' ? <Spinner /> : <CalendarDays className="w-3.5 h-3.5" />} Schedule
                                </button>
                                {canPublishNow && blockedPlatforms.length === 0 && (
                                    <button type="button" onClick={() => void publishNow()} disabled={busy === 'publish'} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[12px] font-medium text-slate-700 disabled:opacity-50">
                                        {busy === 'publish' ? <Spinner /> : <Send className="w-3.5 h-3.5" />} Publish now
                                    </button>
                                )}
                            </div>
                        )}

                        {!!model.approval_history?.length && (
                            <ul className="divide-y divide-slate-100 border border-slate-200 rounded">
                                {model.approval_history.map((h, i) => (
                                    <li key={`${h.at}-${i}`} className="px-2.5 py-2 text-[12px]">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-medium text-slate-800 capitalize">{h.action.replace(/_/g, ' ')}</span>
                                            <span className="text-slate-400">·</span>
                                            <span className="text-slate-500">{h.actor_name || 'System'}</span>
                                            <span className="ml-auto text-slate-400">{formatRelative(h.at)}</span>
                                        </div>
                                        {h.reason && <p className="mt-0.5 text-[11px] text-slate-600">{h.reason}</p>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>

            <MediaPicker open={mediaPickerOpen} onClose={() => setMediaPickerOpen(false)} onPick={addMedia} />
            <ProductPicker open={productPickerOpen} onClose={() => setProductPickerOpen(false)} onPick={addProduct} />

            {rejectOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-3">
                    <div className="w-full max-w-sm bg-white border border-slate-200 rounded shadow-xl">
                        <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-[13px] font-semibold text-slate-900">{rejectOpen === 'reject' ? 'Reject content' : 'Request changes'}</h3>
                            <button type="button" onClick={() => setRejectOpen(null)} className="w-7 h-7 rounded hover:bg-slate-100 text-slate-500 flex items-center justify-center" aria-label="Close"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-3 space-y-2">
                            <label className="block text-[12px] font-medium text-slate-700">Reason</label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                rows={4}
                                className="w-full bg-white border border-slate-200 rounded px-2.5 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-950/20"
                            />
                            <div className="flex items-center justify-end gap-1.5">
                                <button type="button" onClick={() => setRejectOpen(null)} className="px-2.5 py-1.5 rounded border border-slate-200 bg-white text-[12px] text-slate-700">Cancel</button>
                                <button type="button" onClick={confirmReject} disabled={!rejectReason.trim()} className="px-2.5 py-1.5 rounded bg-blue-950 text-white text-[12px] font-medium disabled:opacity-50">Confirm</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ContentStudioPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [me, setMe] = useState<Me | null>(null);
    const [drafts, setDrafts] = useState<ContentDraft[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [capabilities, setCapabilities] = useState<AccountCapability[]>([]);

    const [q, setQ] = useState(searchParams.get('q') ?? '');
    const [platformFilter, setPlatformFilter] = useState<PlatformKey | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [editing, setEditing] = useState<ContentDraft | null>(null);
    const [creating, setCreating] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await listContentRequest({
                q: q.trim() || undefined,
                platform: platformFilter,
                status: statusFilter,
            });
            setDrafts(res.items ?? []);
        } catch (err: any) {
            if (err instanceof ApiError) setError(detailOf(err) ?? 'Could not load content.');
            else if (err instanceof Error) setError(err.message);
            else setError('Could not load content.');
            setDrafts(null);
        } finally {
            setLoading(false);
        }
    }, [q, platformFilter, statusFilter]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const m = { id: 'me' } as any;
                if (!cancelled) setMe(m);
            } catch {
            }
            const c = clientApi();
            try {
                const res =
                    typeof c.social?.campaigns?.options === 'function'
                        ? await c.social.campaigns.options()
                        : typeof c.listCampaigns === 'function'
                            ? await c.listCampaigns()
                            : null;
                if (!cancelled && res?.campaigns) setCampaigns(res.campaigns);
            } catch {
            }
            try {
                if (typeof c.listStaff === 'function') {
                    const res = await c.listStaff();
                    const list = Array.isArray(res) ? res : (res?.staff ?? res?.results ?? []);
                    if (!cancelled) setStaff(list);
                }
            } catch {
            }
            try {
                const res =
                    typeof c.social?.content?.categories?.list === 'function'
                        ? await c.social.content.categories.list()
                        : typeof c.listContentCategories === 'function'
                            ? await c.listContentCategories()
                            : null;
                if (!cancelled && res?.categories) setCategories(res.categories);
            } catch {
            }
            try {
                const res =
                    typeof c.social?.accounts?.list === 'function'
                        ? await c.social.accounts.list()
                        : typeof c.getSocialAccounts === 'function'
                            ? await c.getSocialAccounts()
                            : null;
                if (!cancelled && res?.accounts) {
                    setCapabilities(
                        res.accounts.map((a) => ({
                            platform: a.platform,
                            can_publish: a.status === 'connected',
                            publishing_formats: a.publishing_formats,
                            publishing_restrictions: a.publishing_restrictions,
                            status: a.status,
                        })),
                    );
                }
            } catch {
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        const action = searchParams.get('action');
        const id = searchParams.get('id');
        if (action === 'create') {
            setCreating(true);
            setEditing(null);
            return;
        }
        if (id && editing?.id !== id) {
            (async () => {
                try {
                    const d = await getContentRequest(id);
                    setEditing(d);
                } catch {
                }
            })();
        }
    }, [searchParams, editing?.id]);

    const canEdit = useMemo(() => {
        const m = me as unknown as {
            permissions?: string[];
            role?: string;
            is_admin?: boolean;
            is_staff?: boolean;
            is_superuser?: boolean;
        } | null;
        if (!m) return false;
        if (m.is_superuser || m.is_admin || m.is_staff) return true;
        if (m.role === 'admin' || m.role === 'owner' || m.role === 'editor') return true;
        if (Array.isArray(m.permissions) && m.permissions.some((p) => ['manage_social_content', 'manage_social_accounts'].includes(p))) return true;
        return false;
    }, [me]);

    const canApprove = useMemo(() => {
        const m = me as unknown as {
            permissions?: string[];
            role?: string;
            is_admin?: boolean;
            is_staff?: boolean;
            is_superuser?: boolean;
        } | null;
        if (!m) return false;
        if (m.is_superuser || m.is_admin || m.is_staff) return true;
        if (m.role === 'admin' || m.role === 'owner' || m.role === 'approver') return true;
        if (Array.isArray(m.permissions) && m.permissions.includes('approve_social_content')) return true;
        return false;
    }, [me]);

    const handleOpen = (d: ContentDraft) => {
        setEditing(d);
        setCreating(false);
    };

    const handleCreate = () => {
        setCreating(true);
        setEditing(null);
    };

    const closeEditor = () => {
        setEditing(null);
        setCreating(false);
        router.replace('/social/content-studio');
    };

    const handleDuplicate = async (id: string) => {
        try {
            const copy = await duplicateContentRequest(id);
            await load();
            setEditing(copy);
        } catch (err: any) {
            if (err instanceof ApiError) setError(detailOf(err) ?? 'Duplicate failed.');
            else if (err instanceof Error) setError(err.message);
            else setError('Duplicate failed.');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteContentRequest(id);
            await load();
        } catch (err: any) {
            if (err instanceof ApiError) setError(detailOf(err) ?? 'Delete failed.');
            else if (err instanceof Error) setError(err.message);
            else setError('Delete failed.');
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
        });
    };

    const filtered = drafts ?? [];

    const draftCount = filtered.filter((d) => d.status === 'draft').length;
    const awaitingApproval = filtered.filter((d) => d.status === 'in_review').length;
    const recentlyEdited = filtered.slice().sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '')).slice(0, 1)[0];

    const editorModel: ContentDraft | null = editing ?? (creating ? { ...emptyDraft() } : null);

    return (
        <div className="space-y-3">
            <header className="bg-white border border-slate-200 rounded p-3 sm:p-4 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-[18px] font-semibold text-slate-900">Content Studio</h1>
                        <p className="text-[12px] sm:text-[13px] text-slate-500">
                            Create, review, and prepare content for YouTube, Facebook, Instagram and TikTok.
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={!canEdit}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-blue-950 hover:bg-blue-900 text-white text-[12px] font-medium disabled:opacity-50"
                        >
                            <Plus className="w-3.5 h-3.5" /> Create content
                        </button>
                        <button
                            type="button"
                            onClick={() => void load()}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[12px] text-slate-700"
                        >
                            <RefreshCw className="w-3.5 h-3.5" /> Refresh
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    <span><span className="text-slate-700 font-medium">{draftCount}</span> drafts</span>
                    <span><span className="text-slate-700 font-medium">{awaitingApproval}</span> awaiting approval</span>
                    {recentlyEdited && (
                        <span className="truncate">
                            Last edited:{' '}
                            <span className="text-slate-700">{recentlyEdited.title || 'Untitled'}</span>{' '}
                            <span className="text-slate-400">· {formatRelative(recentlyEdited.updated_at)}</span>
                        </span>
                    )}
                </div>

                {error && (
                    <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2 text-[12px] text-rose-700 flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">{error}</span>
                        <button type="button" onClick={() => void load()} className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border border-rose-300 bg-white hover:bg-rose-50 text-[11px] font-medium text-rose-700">
                            <RefreshCw className="w-3 h-3" /> Retry
                        </button>
                    </div>
                )}
            </header>

            <div className="bg-white border border-slate-200 rounded p-2.5 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search title, caption, owner"
                        className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-950/20"
                    />
                </div>
                <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value as PlatformKey | 'all')} className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-700">
                    <option value="all">All platforms</option>
                    {PLATFORM_ORDER.map((p) => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ContentStatus | 'all')} className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-700">
                    <option value="all">All statuses</option>
                    {Object.keys(STATUS_META).map((s) => <option key={s} value={s}>{STATUS_META[s as ContentStatus].label}</option>)}
                </select>
                <div className="inline-flex rounded border border-slate-200 overflow-hidden">
                    <button type="button" onClick={() => setViewMode('grid')} className={`px-2 py-1.5 ${viewMode === 'grid' ? 'bg-blue-950 text-white' : 'bg-white text-slate-600'}`} aria-label="Grid view"><Grid3x3 className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => setViewMode('list')} className={`px-2 py-1.5 ${viewMode === 'list' ? 'bg-blue-950 text-white' : 'bg-white text-slate-600'}`} aria-label="List view"><LayoutList className="w-3.5 h-3.5" /></button>
                </div>
                {selectedIds.size > 0 && (
                    <span className="ml-auto text-[11px] text-slate-500">{selectedIds.size} selected</span>
                )}
            </div>

            {editorModel ? (
                <ContentEditor
                    draft={editorModel}
                    capabilities={capabilities}
                    campaigns={campaigns}
                    staff={staff}
                    categories={categories}
                    me={me}
                    canEdit={canEdit}
                    canApprove={canApprove}
                    onSaved={(d) => setDrafts((list) => {
                        if (!list) return [d];
                        const i = list.findIndex((x) => x.id === d.id);
                        if (i === -1) return [d, ...list];
                        const copy = [...list]; copy[i] = d; return copy;
                    })}
                    onDeleted={(id) => {
                        setDrafts((list) => (list ? list.filter((x) => x.id !== id) : []));
                        closeEditor();
                    }}
                    onClose={closeEditor}
                />
            ) : loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white border border-slate-200 rounded overflow-hidden animate-pulse">
                            <div className="aspect-video bg-slate-100" />
                            <div className="p-2.5 space-y-1.5">
                                <div className="h-3 w-2/3 bg-slate-100 rounded" />
                                <div className="h-2.5 w-1/2 bg-slate-100 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : !drafts || drafts.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded p-6 text-center">
                    <div className="w-12 h-12 mx-auto rounded-full bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center">
                        <Pencil className="w-5 h-5" />
                    </div>
                    <h3 className="mt-2 text-[13px] font-semibold text-slate-900">No content yet</h3>
                    <p className="text-[12px] text-slate-500 mt-1 max-w-md mx-auto">
                        Start with a draft. You can link products, preview platform-specific fields and send for approval.
                    </p>
                    <button type="button" onClick={handleCreate} disabled={!canEdit} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-950 text-white text-[12px] font-medium disabled:opacity-50">
                        <Plus className="w-3.5 h-3.5" /> Create content
                    </button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded p-6 text-center text-[12px] text-slate-500">
                    No content matches these filters.
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {filtered.map((d) => (
                        <ContentCard
                            key={d.id}
                            item={d}
                            selected={selectedIds.has(d.id)}
                            onSelect={() => toggleSelect(d.id)}
                            onOpen={() => handleOpen(d)}
                            onDuplicate={() => void handleDuplicate(d.id)}
                            onDelete={() => void handleDelete(d.id)}
                            canEdit={canEdit}
                        />
                    ))}
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded overflow-x-auto">
                    <table className="w-full text-[12px] min-w-[760px]">
                        <thead>
                            <tr className="text-left text-slate-500 border-b border-slate-100">
                                <th className="py-2 px-2 w-8" />
                                <th className="py-2 pr-2 font-medium">Title</th>
                                <th className="py-2 pr-2 font-medium">Type</th>
                                <th className="py-2 pr-2 font-medium">Platforms</th>
                                <th className="py-2 pr-2 font-medium">Owner</th>
                                <th className="py-2 pr-2 font-medium">Status</th>
                                <th className="py-2 pr-2 font-medium">Edited</th>
                                <th className="py-2 pr-2 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((d) => (
                                <tr key={d.id} className="border-b border-slate-50 last:border-b-0">
                                    <td className="py-2 px-2">
                                        <input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggleSelect(d.id)} className="accent-blue-950" />
                                    </td>
                                    <td className="py-2 pr-2">
                                        <button type="button" onClick={() => handleOpen(d)} className="text-slate-900 font-medium truncate max-w-[220px] text-left hover:underline">
                                            {d.title || 'Untitled'}
                                        </button>
                                    </td>
                                    <td className="py-2 pr-2 text-slate-600">{CONTENT_TYPE_LABEL[d.content_type]}</td>
                                    <td className="py-2 pr-2">
                                        <div className="flex items-center gap-1">
                                            {d.platforms.map((p) => {
                                                const Icon = PLATFORM_META[p].icon;
                                                return (
                                                    <span key={p} className={`inline-flex items-center justify-center w-5 h-5 rounded ${PLATFORM_META[p].brand}`}>
                                                        <Icon className="w-3 h-3" />
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </td>
                                    <td className="py-2 pr-2 text-slate-600 truncate max-w-[140px]">{d.owner_name || '—'}</td>
                                    <td className="py-2 pr-2"><StatusBadge status={d.status} /></td>
                                    <td className="py-2 pr-2 text-slate-500">{formatRelative(d.updated_at)}</td>
                                    <td className="py-2 pr-2">
                                        <div className="flex items-center gap-1">
                                            <button type="button" onClick={() => handleOpen(d)} className="p-1 rounded hover:bg-slate-100 text-slate-600" title="Open"><Pencil className="w-3 h-3" /></button>
                                            <button type="button" onClick={() => void handleDuplicate(d.id)} disabled={!canEdit} className="p-1 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40" title="Duplicate"><Copy className="w-3 h-3" /></button>
                                            <button type="button" onClick={() => void handleDelete(d.id)} disabled={!canEdit} className="p-1 rounded hover:bg-rose-50 text-rose-600 disabled:opacity-40" title="Delete"><Trash2 className="w-3 h-3" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default function ContentStudioPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-[300px] flex items-center justify-center p-6">
                    <div className="flex items-center gap-2 text-slate-500 text-[13px]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading Content Studio…
                    </div>
                </div>
            }
        >
            <ContentStudioPageContent />
        </Suspense>
    );
}