'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    AlertTriangle,
    Calendar as CalendarIcon,
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    ExternalLink,
    Filter,
    Grid3x3,
    History,
    LayoutList,
    Loader2,
    Plus,
    RefreshCw,
    Search,
    Send,
    X,
    XCircle,
    type LucideIcon,
} from 'lucide-react';
import { type IconType } from 'react-icons';
import { FaFacebook, FaInstagram, FaTiktok, FaYoutube } from 'react-icons/fa';
import { api, ApiError, type Me } from '@/lib/api';

type PlatformKey = 'youtube' | 'facebook' | 'instagram' | 'tiktok';

type PublishStatus =
    | 'draft'
    | 'pending_approval'
    | 'approved'
    | 'scheduled'
    | 'queued'
    | 'publishing'
    | 'published'
    | 'failed'
    | 'cancelled'
    | 'expired';

type CalendarView = 'month' | 'week' | 'day' | 'agenda';

type ScheduledPost = {
    id: string;
    content_id: string;
    content_title: string;
    thumbnail_url?: string | null;
    caption?: string | null;
    content_type?: string | null;
    platform: PlatformKey;
    account_id?: string | null;
    account_name?: string | null;
    scheduled_at: string;
    status: PublishStatus;
    campaign_id?: string | null;
    campaign_name?: string | null;
    owner_id?: string | null;
    owner_name?: string | null;
    approver_id?: string | null;
    approver_name?: string | null;
    published_at?: string | null;
    published_url?: string | null;
    published_post_id?: string | null;
    attempt_at?: string | null;
    platform_response?: string | null;
    failure_reason?: string | null;
    retry_history?: Array<{ at: string; status: 'success' | 'failure'; message?: string | null }>;
    last_error_at?: string | null;
    is_manual_reminder?: boolean;
};

type ListPayload = {
    posts: ScheduledPost[];
    time_zone?: string | null;
    server_now?: string | null;
};

type Campaign = { id: string; name: string };
type StaffMember = { id: string; name: string };
type ContentRef = { id: string; title: string; content_type?: string | null; platforms?: PlatformKey[] | null };

type AccountCapability = {
    account_id: string;
    account_name?: string | null;
    platform: PlatformKey;
    status: string;
    can_publish: boolean;
    publishing_formats?: string[];
    publishing_restrictions?: string[];
};

type HistoryEntry = {
    at: string;
    status: PublishStatus | string;
    actor_name?: string | null;
    message?: string | null;
    published_url?: string | null;
};

const PLATFORM_META: Record<
    PlatformKey,
    { label: string; icon: IconType; brand: string; dot: string }
> = {
    youtube: { label: 'YouTube', icon: FaYoutube, brand: 'text-rose-600 bg-rose-50', dot: 'bg-rose-500' },
    facebook: { label: 'Facebook', icon: FaFacebook, brand: 'text-blue-700 bg-blue-50', dot: 'bg-blue-500' },
    instagram: { label: 'Instagram', icon: FaInstagram, brand: 'text-pink-600 bg-pink-50', dot: 'bg-pink-500' },
    tiktok: { label: 'TikTok', icon: FaTiktok, brand: 'text-slate-900 bg-slate-100', dot: 'bg-slate-800' },
};

const PLATFORM_ORDER: PlatformKey[] = ['youtube', 'facebook', 'instagram', 'tiktok'];

const STATUS_META: Record<PublishStatus, { label: string; chip: string; dot: string }> = {
    draft: { label: 'Draft', chip: 'bg-slate-50 border-slate-200 text-slate-600', dot: 'bg-slate-400' },
    pending_approval: { label: 'Pending approval', chip: 'bg-blue-50 border-blue-200 text-blue-700', dot: 'bg-blue-500' },
    approved: { label: 'Approved', chip: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500' },
    scheduled: { label: 'Scheduled', chip: 'bg-indigo-50 border-indigo-200 text-indigo-700', dot: 'bg-indigo-500' },
    queued: { label: 'Queued', chip: 'bg-violet-50 border-violet-200 text-violet-700', dot: 'bg-violet-500' },
    publishing: { label: 'Publishing…', chip: 'bg-blue-50 border-blue-200 text-blue-700', dot: 'bg-blue-500 animate-pulse' },
    published: { label: 'Published', chip: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500' },
    failed: { label: 'Failed', chip: 'bg-rose-50 border-rose-200 text-rose-700', dot: 'bg-rose-500' },
    cancelled: { label: 'Cancelled', chip: 'bg-slate-100 border-slate-200 text-slate-500', dot: 'bg-slate-400' },
    expired: { label: 'Expired', chip: 'bg-slate-100 border-slate-200 text-slate-500', dot: 'bg-slate-400' },
};

const EDITABLE_STATUSES: PublishStatus[] = ['draft', 'pending_approval', 'approved', 'scheduled', 'queued', 'failed'];

function detailOf(err: ApiError): string | null {
    if (typeof err.data === 'object' && err.data && 'detail' in err.data) {
        const d = (err.data as { detail: unknown }).detail;
        if (typeof d === 'string') return d;
    }
    return null;
}

function pad2(n: number) {
    return n < 10 ? `0${n}` : `${n}`;
}

function ymd(d: Date): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfWeek(d: Date): Date {
    const copy = new Date(d);
    const day = copy.getDay();
    copy.setDate(copy.getDate() - day);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function addDays(d: Date, n: number): Date {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + n);
    return copy;
}

function sameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(iso: string, tz?: string | null): string {
    try {
        return new Intl.DateTimeFormat(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: tz || undefined,
        }).format(new Date(iso));
    } catch {
        return new Date(iso).toLocaleTimeString();
    }
}

function formatDateTime(iso: string, tz?: string | null): string {
    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: tz || undefined,
        }).format(new Date(iso));
    } catch {
        return new Date(iso).toLocaleString();
    }
}

function formatRelative(iso: string | null | undefined): string {
    if (!iso) return '—';
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return '—';
    const diff = Date.now() - t;
    if (diff < 0) return `in ${Math.abs(Math.round(diff / 60000))}m`;
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

type ApiWithPublishingCalendar = {
    social?: {
        calendar?: {
            posts?: {
                list?: (q: Record<string, unknown>) => Promise<ListPayload>;
                schedule?: (body: Record<string, unknown>) => Promise<ScheduledPost>;
                reschedule?: (id: string, scheduled_at: string) => Promise<ScheduledPost>;
                cancel?: (id: string, reason?: string) => Promise<ScheduledPost>;
                retry?: (id: string) => Promise<ScheduledPost>;
                publishNow?: (id: string) => Promise<ScheduledPost>;
                history?: (id: string) => Promise<{ history: HistoryEntry[] }>;
            };
        };
        content?: {
            schedulingOptions?: (q?: string) => Promise<{ items: ContentRef[] }>;
        };
        campaigns?: {
            options?: () => Promise<{ campaigns: Campaign[] }>;
        };
        accounts?: {
            capabilities?: () => Promise<{ accounts: AccountCapability[] }>;
            list?: () => Promise<{
                accounts: Array<{
                    id: string;
                    platform: PlatformKey;
                    status: string;
                    display_name?: string | null;
                    username?: string | null;
                    account_name?: string | null;
                    publishing_formats?: string[];
                    publishing_restrictions?: string[];
                }>;
            }>;
        };
    };
    listSocialScheduledPosts?: (q: Record<string, unknown>) => Promise<ListPayload>;
    scheduleSocialPost?: (body: Record<string, unknown>) => Promise<ScheduledPost>;
    rescheduleSocialPost?: (id: string, scheduled_at: string) => Promise<ScheduledPost>;
    cancelSocialPost?: (id: string, reason?: string) => Promise<ScheduledPost>;
    retrySocialPost?: (id: string) => Promise<ScheduledPost>;
    publishSocialPostNow?: (id: string) => Promise<ScheduledPost>;
    getSocialPostHistory?: (id: string) => Promise<{ history: HistoryEntry[] }>;
    listContentForScheduling?: (q?: { q?: string }) => Promise<{ items: ContentRef[] }>;
    listCampaigns?: () => Promise<{ campaigns: Campaign[] }>;
    listStaff?: () => Promise<StaffMember[] | { staff?: StaffMember[]; results?: StaffMember[] }>;
    getSocialAccounts?: () => Promise<{
        accounts: Array<{
            id: string;
            platform: PlatformKey;
            status: string;
            display_name?: string | null;
            username?: string | null;
            account_name?: string | null;
            publishing_formats?: string[];
            publishing_restrictions?: string[];
        }>;
    }>;
};

const clientApi = () => api as unknown as ApiWithPublishingCalendar;

async function listScheduledPostsRequest(q: Record<string, unknown>): Promise<ListPayload> {
    const c = clientApi();
    if (typeof c.social?.calendar?.posts?.list === 'function') return c.social.calendar.posts.list(q);
    if (typeof c.listSocialScheduledPosts === 'function') return c.listSocialScheduledPosts(q);
    throw new Error('Publishing calendar endpoint is not available.');
}

async function schedulePostRequest(body: Record<string, unknown>): Promise<ScheduledPost> {
    const c = clientApi();
    if (typeof c.social?.calendar?.posts?.schedule === 'function') return c.social.calendar.posts.schedule(body);
    if (typeof c.scheduleSocialPost === 'function') return c.scheduleSocialPost(body);
    throw new Error('Schedule post endpoint is not available.');
}

async function reschedulePostRequest(id: string, scheduled_at: string): Promise<ScheduledPost> {
    const c = clientApi();
    if (typeof c.social?.calendar?.posts?.reschedule === 'function') return c.social.calendar.posts.reschedule(id, scheduled_at);
    if (typeof c.rescheduleSocialPost === 'function') return c.rescheduleSocialPost(id, scheduled_at);
    throw new Error('Reschedule endpoint is not available.');
}

async function cancelPostRequest(id: string, reason?: string): Promise<ScheduledPost> {
    const c = clientApi();
    if (typeof c.social?.calendar?.posts?.cancel === 'function') return c.social.calendar.posts.cancel(id, reason);
    if (typeof c.cancelSocialPost === 'function') return c.cancelSocialPost(id, reason);
    throw new Error('Cancel endpoint is not available.');
}

async function retryPostRequest(id: string): Promise<ScheduledPost> {
    const c = clientApi();
    if (typeof c.social?.calendar?.posts?.retry === 'function') return c.social.calendar.posts.retry(id);
    if (typeof c.retrySocialPost === 'function') return c.retrySocialPost(id);
    throw new Error('Retry endpoint is not available.');
}

async function publishNowPostRequest(id: string): Promise<ScheduledPost> {
    const c = clientApi();
    if (typeof c.social?.calendar?.posts?.publishNow === 'function') return c.social.calendar.posts.publishNow(id);
    if (typeof c.publishSocialPostNow === 'function') return c.publishSocialPostNow(id);
    throw new Error('Publish now endpoint is not available.');
}

async function getPostHistoryRequest(id: string): Promise<{ history: HistoryEntry[] }> {
    const c = clientApi();
    if (typeof c.social?.calendar?.posts?.history === 'function') return c.social.calendar.posts.history(id);
    if (typeof c.getSocialPostHistory === 'function') return c.getSocialPostHistory(id);
    throw new Error('Post history endpoint is not available.');
}

async function listContentForSchedulingRequest(q?: { q?: string }): Promise<{ items: ContentRef[] }> {
    const c = clientApi();
    if (typeof c.social?.content?.schedulingOptions === 'function') return c.social.content.schedulingOptions(q?.q);
    if (typeof c.listContentForScheduling === 'function') return c.listContentForScheduling(q);
    throw new Error('Content list endpoint is not available.');
}

function Spinner({ className = 'w-3.5 h-3.5' }: { className?: string }) {
    return <Loader2 className={`animate-spin ${className}`} />;
}

function StatusBadge({ status }: { status: PublishStatus }) {
    const sm = STATUS_META[status];
    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] ${sm.chip}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
            {sm.label}
        </span>
    );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-2">
            <dt className="text-slate-500 shrink-0">{label}</dt>
            <dd className={`text-right truncate ${mono ? 'font-mono text-[11px]' : ''} text-slate-800`}>{value}</dd>
        </div>
    );
}

function CalendarEventChip({
    post,
    tz,
    onClick,
    compact,
}: {
    post: ScheduledPost;
    tz: string | null;
    onClick: () => void;
    compact?: boolean;
}) {
    const pm = PLATFORM_META[post.platform];
    const Icon = pm.icon;
    const sm = STATUS_META[post.status];
    return (
        <button
            type="button"
            onClick={onClick}
            draggable
            onDragStart={(e) => {
                e.dataTransfer.setData('text/post-id', post.id);
            }}
            className={`w-full text-left rounded border px-1.5 py-1 hover:bg-slate-50 transition ${compact ? 'mb-1' : ''} bg-white border-slate-200`}
            title={`${pm.label} · ${post.content_title} · ${formatDateTime(post.scheduled_at, tz)}`}
        >
            <div className="flex items-center gap-1 min-w-0">
                <span className={`inline-flex items-center justify-center w-4 h-4 rounded shrink-0 ${pm.brand}`}>
                    <Icon className="w-2.5 h-2.5" />
                </span>
                <span className="text-[10px] text-slate-500 shrink-0">{formatTime(post.scheduled_at, tz)}</span>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sm.dot}`} />
                {post.is_manual_reminder && (
                    <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1">reminder</span>
                )}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-800 font-medium truncate">
                {post.content_title || 'Untitled'}
            </div>
        </button>
    );
}

function PostDrawer({
    post,
    tz,
    onClose,
    onChanged,
    canEdit,
    canCancel,
}: {
    post: ScheduledPost;
    tz: string | null;
    onClose: () => void;
    onChanged: (p: ScheduledPost | null) => void;
    canEdit: boolean;
    canCancel: boolean;
}) {
    const [history, setHistory] = useState<HistoryEntry[] | null>(null);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [rescheduleAt, setRescheduleAt] = useState<string>('');
    const [confirmCancel, setConfirmCancel] = useState(false);

    useEffect(() => {
        setHistory(null);
        setHistoryError(null);
        setError(null);
        setRescheduleAt('');
        setConfirmCancel(false);
        (async () => {
            try {
                const res = await getPostHistoryRequest(post.id);
                setHistory(res.history ?? []);
            } catch (err) {
                if (err instanceof ApiError) setHistoryError(detailOf(err) ?? 'Could not load history.');
                else if (err instanceof Error) setHistoryError(err.message);
                else setHistoryError('Could not load history.');
            }
        })();
    }, [post.id]);

    const run = async (key: string, fn: () => Promise<ScheduledPost>) => {
        setBusy(key);
        setError(null);
        try {
            const next = await fn();
            onChanged(next);
        } catch (err) {
            if (err instanceof ApiError) setError(detailOf(err) ?? 'Action failed.');
            else if (err instanceof Error) setError(err.message);
            else setError('Action failed.');
        } finally {
            setBusy(null);
        }
    };

    const handleReschedule = () => {
        if (!rescheduleAt) return;
        const iso = new Date(rescheduleAt).toISOString();
        void run('reschedule', () => reschedulePostRequest(post.id, iso));
    };

    const handleCancel = () => {
        void run('cancel', () => cancelPostRequest(post.id));
    };

    const handleRetry = () => {
        void run('retry', () => retryPostRequest(post.id));
    };

    const handlePublishNow = () => {
        void run('publish-now', () => publishNowPostRequest(post.id));
    };

    const pm = PLATFORM_META[post.platform];
    const Icon = pm.icon;
    const editable = canEdit && EDITABLE_STATUSES.includes(post.status);

    return (
        <div className="fixed inset-0 z-40">
            <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
            <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white border-l border-slate-200 shadow-xl flex flex-col">
                <header className="flex items-start gap-2 px-3 py-3 border-b border-slate-100">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded ${pm.brand}`}>
                        <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-slate-900 truncate">
                            {post.content_title || 'Untitled'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                            {pm.label}
                            {post.account_name ? ` · ${post.account_name}` : ''}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <StatusBadge status={post.status} />
                            {post.is_manual_reminder && (
                                <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-1">Manual reminder</span>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-7 h-7 rounded hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-[12px]">
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded px-2.5 py-2 text-[12px] text-rose-700">
                            {error}
                        </div>
                    )}

                    {post.status === 'failed' && post.failure_reason && (
                        <div className="bg-rose-50 border border-rose-200 rounded px-2.5 py-2 text-[12px] text-rose-700 flex items-start gap-1.5">
                            <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span className="min-w-0">{post.failure_reason}</span>
                        </div>
                    )}

                    <section className="border border-slate-200 rounded">
                        <h4 className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 border-b border-slate-100 uppercase tracking-wide">
                            Schedule
                        </h4>
                        <div className="px-2.5 py-2 space-y-1.5">
                            <Row label="Scheduled for" value={`${formatDateTime(post.scheduled_at, tz)}${tz ? ` (${tz})` : ''}`} />
                            <Row label="Account" value={post.account_name ?? '—'} />
                            <Row label="Content type" value={post.content_type ?? '—'} />
                            {post.campaign_name && <Row label="Campaign" value={post.campaign_name} />}
                            {post.owner_name && <Row label="Scheduled by" value={post.owner_name} />}
                            {post.approver_name && <Row label="Approved by" value={post.approver_name} />}
                            <Row
                                label="Content"
                                value={
                                    <Link href={`/social/content-studio?id=${post.content_id}`} className="text-blue-950 hover:underline inline-flex items-center gap-1">
                                        Open in Content Studio
                                        <ExternalLink className="w-3 h-3" />
                                    </Link>
                                }
                            />
                        </div>
                    </section>

                    {post.status === 'published' && (
                        <section className="border border-emerald-200 rounded">
                            <h4 className="px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border-b border-emerald-100 uppercase tracking-wide">
                                Publication
                            </h4>
                            <div className="px-2.5 py-2 space-y-1.5">
                                <Row label="Published at" value={formatDateTime(post.published_at ?? '', tz)} />
                                {post.published_post_id && <Row label="Post ID" value={post.published_post_id} mono />}
                                {post.published_url && (
                                    <Row
                                        label="URL"
                                        value={
                                            <a href={post.published_url} target="_blank" rel="noreferrer noopener" className="text-blue-950 hover:underline inline-flex items-center gap-1">
                                                Open post <ExternalLink className="w-3 h-3" />
                                            </a>
                                        }
                                    />
                                )}
                            </div>
                        </section>
                    )}

                    {editable && (
                        <section className="border border-slate-200 rounded">
                            <h4 className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 border-b border-slate-100 uppercase tracking-wide">
                                Reschedule
                            </h4>
                            <div className="px-2.5 py-2 space-y-1.5">
                                <input
                                    type="datetime-local"
                                    value={rescheduleAt}
                                    onChange={(e) => setRescheduleAt(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-950/20"
                                />
                                <button
                                    type="button"
                                    onClick={handleReschedule}
                                    disabled={!rescheduleAt || busy === 'reschedule'}
                                    className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 disabled:opacity-50"
                                >
                                    {busy === 'reschedule' ? <Spinner /> : <Clock className="w-3 h-3" />}
                                    Apply reschedule
                                </button>
                                <p className="text-[10px] text-slate-400">
                                    Times are interpreted in your account time zone ({tz ?? 'server'}).
                                </p>
                            </div>
                        </section>
                    )}

                    <section className="border border-slate-200 rounded">
                        <h4 className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 border-b border-slate-100 uppercase tracking-wide">
                            Actions
                        </h4>
                        <div className="px-2.5 py-2 grid grid-cols-2 gap-1.5">
                            {post.status === 'failed' && canEdit && (
                                <button type="button" onClick={handleRetry} disabled={busy === 'retry'} className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 disabled:opacity-50">
                                    {busy === 'retry' ? <Spinner /> : <RefreshCw className="w-3 h-3" />}
                                    Retry now
                                </button>
                            )}
                            {['approved', 'scheduled', 'queued'].includes(post.status) && canEdit && (
                                <button type="button" onClick={handlePublishNow} disabled={busy === 'publish-now'} className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-blue-950 hover:bg-blue-900 text-white text-[11px] font-medium disabled:opacity-50">
                                    {busy === 'publish-now' ? <Spinner /> : <Send className="w-3 h-3" />}
                                    Publish now
                                </button>
                            )}
                            {canCancel && ['draft', 'pending_approval', 'approved', 'scheduled', 'queued'].includes(post.status) && (
                                confirmCancel ? (
                                    <>
                                        <button type="button" onClick={() => setConfirmCancel(false)} className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] text-slate-700">
                                            Keep
                                        </button>
                                        <button type="button" onClick={handleCancel} disabled={busy === 'cancel'} className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-medium disabled:opacity-50">
                                            {busy === 'cancel' ? <Spinner /> : <XCircle className="w-3 h-3" />}
                                            Confirm cancel
                                        </button>
                                    </>
                                ) : (
                                    <button type="button" onClick={() => setConfirmCancel(true)} className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded border border-rose-300 bg-white hover:bg-rose-50 text-[11px] font-medium text-rose-700">
                                        <XCircle className="w-3 h-3" />
                                        Cancel post
                                    </button>
                                )
                            )}
                        </div>
                    </section>

                    <section className="border border-slate-200 rounded">
                        <h4 className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 border-b border-slate-100 uppercase tracking-wide flex items-center gap-1">
                            <History className="w-3 h-3" />
                            History
                        </h4>
                        <div className="px-2.5 py-2">
                            {historyError && <div className="text-[11px] text-rose-700">{historyError}</div>}
                            {!historyError && !history && (
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                    <Spinner /> Loading history…
                                </div>
                            )}
                            {history && history.length === 0 && <div className="text-[11px] text-slate-500">No history yet.</div>}
                            {history && history.length > 0 && (
                                <ul className="space-y-1.5">
                                    {history.map((h, i) => (
                                        <li key={`${h.at}-${i}`} className="text-[11px]">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-medium text-slate-800">{STATUS_META[(h.status as PublishStatus)]?.label ?? h.status}</span>
                                                {h.actor_name && <span className="text-slate-500">· {h.actor_name}</span>}
                                                <span className="ml-auto text-slate-400">{formatRelative(h.at)}</span>
                                            </div>
                                            {h.message && <div className="text-slate-600">{h.message}</div>}
                                            {h.published_url && (
                                                <a href={h.published_url} target="_blank" rel="noreferrer noopener" className="text-blue-950 hover:underline inline-flex items-center gap-1">
                                                    Open post <ExternalLink className="w-2.5 h-2.5" />
                                                </a>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </section>

                    {post.retry_history?.length ? (
                        <section className="border border-slate-200 rounded">
                            <h4 className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 border-b border-slate-100 uppercase tracking-wide">
                                Retry history
                            </h4>
                            <ul className="px-2.5 py-2 space-y-1">
                                {post.retry_history.map((r, i) => (
                                    <li key={`${r.at}-${i}`} className="flex items-start gap-1.5 text-[11px]">
                                        {r.status === 'success' ? <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-600 shrink-0" /> : <XCircle className="w-3 h-3 mt-0.5 text-rose-600 shrink-0" />}
                                        <span className="text-slate-600">{formatRelative(r.at)}{r.message ? ` · ${r.message}` : ''}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function ScheduleModal({
    open,
    initialDate,
    capabilities,
    onClose,
    onScheduled,
}: {
    open: boolean;
    initialDate: Date;
    capabilities: AccountCapability[];
    onClose: () => void;
    onScheduled: (p: ScheduledPost) => void;
}) {
    const [query, setQuery] = useState('');
    const [contentList, setContentList] = useState<ContentRef[] | null>(null);
    const [contentError, setContentError] = useState<string | null>(null);
    const [contentLoading, setContentLoading] = useState(false);

    const [selectedContent, setSelectedContent] = useState<ContentRef | null>(null);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [scheduledAt, setScheduledAt] = useState('');
    const [asReminder, setAsReminder] = useState(false);

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        const d = initialDate;
        const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T09:00`;
        setScheduledAt(iso);
        setSelectedContent(null);
        setSelectedAccountId('');
        setAsReminder(false);
        setError(null);
        setQuery('');
    }, [open, initialDate]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        (async () => {
            setContentLoading(true);
            setContentError(null);
            try {
                const res = await listContentForSchedulingRequest({ q: query.trim() || undefined });
                if (!cancelled) setContentList(res.items ?? []);
            } catch (err) {
                if (cancelled) return;
                if (err instanceof ApiError) setContentError(detailOf(err) ?? 'Could not load content.');
                else if (err instanceof Error) setContentError(err.message);
                else setContentError('Could not load content.');
                setContentList(null);
            } finally {
                if (!cancelled) setContentLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [open, query]);

    const eligibleAccounts = useMemo(() => {
        if (!selectedContent) return capabilities;
        const platforms = selectedContent.platforms ?? [];
        if (platforms.length === 0) return capabilities;
        return capabilities.filter((c) => platforms.includes(c.platform));
    }, [capabilities, selectedContent]);

    const selectedAccount = useMemo(
        () => eligibleAccounts.find((a) => a.account_id === selectedAccountId) ?? null,
        [eligibleAccounts, selectedAccountId],
    );

    const accountCannotPublish = !!selectedAccount && !selectedAccount.can_publish;
    const needsReminder = accountCannotPublish && !asReminder;

    const submit = async () => {
        if (!selectedContent || !selectedAccount || !scheduledAt) return;
        if (needsReminder) return;
        setBusy(true);
        setError(null);
        try {
            const post = await schedulePostRequest({
                content_id: selectedContent.id,
                platform: selectedAccount.platform,
                account_id: selectedAccount.account_id,
                scheduled_at: new Date(scheduledAt).toISOString(),
                as_reminder: asReminder,
            });
            onScheduled(post);
            onClose();
        } catch (err) {
            if (err instanceof ApiError) setError(detailOf(err) ?? 'Could not schedule post.');
            else if (err instanceof Error) setError(err.message);
            else setError('Could not schedule post.');
        } finally {
            setBusy(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-3">
            <div className="w-full max-w-2xl bg-white border border-slate-200 rounded shadow-xl max-h-[92vh] flex flex-col">
                <header className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100">
                    <h3 className="text-[13px] font-semibold text-slate-900">Schedule post</h3>
                    <button type="button" onClick={onClose} className="w-7 h-7 rounded hover:bg-slate-100 text-slate-500 flex items-center justify-center" aria-label="Close">
                        <X className="w-4 h-4" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {error && <div className="bg-rose-50 border border-rose-200 rounded px-2.5 py-2 text-[12px] text-rose-700">{error}</div>}

                    <section className="border border-slate-200 rounded">
                        <h4 className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 border-b border-slate-100 uppercase tracking-wide">
                            1. Select content
                        </h4>
                        <div className="p-2.5 space-y-2">
                            <div className="flex items-center gap-1.5">
                                <Search className="w-3.5 h-3.5 text-slate-400" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search content by title"
                                    className="flex-1 bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-950/20"
                                />
                            </div>
                            {contentLoading && <div className="flex items-center gap-1.5 text-[12px] text-slate-500 py-2"><Spinner /> Loading…</div>}
                            {contentError && <div className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1.5">{contentError}</div>}
                            {contentList && contentList.length === 0 && (
                                <div className="text-[12px] text-slate-500 py-2 text-center">
                                    No content available. Create a draft in <Link href="/social/content-studio?action=create" className="text-blue-950 hover:underline">Content Studio</Link>.
                                </div>
                            )}
                            {contentList && contentList.length > 0 && (
                                <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                                    {contentList.map((c) => (
                                        <li key={c.id}>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedContent(c)}
                                                className={`w-full text-left px-2 py-1.5 rounded text-[12px] flex items-center gap-2 ${selectedContent?.id === c.id ? 'bg-blue-950/5 border border-blue-950/20' : 'hover:bg-slate-50 border border-transparent'}`}
                                            >
                                                <span className="min-w-0 flex-1">
                                                    <span className="block font-medium text-slate-900 truncate">{c.title}</span>
                                                    <span className="block text-[11px] text-slate-500 truncate">
                                                        {c.content_type ?? '—'}
                                                        {c.platforms?.length ? ` · ${c.platforms.map((p) => PLATFORM_META[p]?.label).join(', ')}` : ''}
                                                    </span>
                                                </span>
                                                {selectedContent?.id === c.id && <CheckCircle2 className="w-3.5 h-3.5 text-blue-950" />}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </section>

                    <section className="border border-slate-200 rounded">
                        <h4 className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 border-b border-slate-100 uppercase tracking-wide">
                            2. Select account
                        </h4>
                        <div className="p-2.5 space-y-1.5">
                            {eligibleAccounts.length === 0 ? (
                                <p className="text-[12px] text-slate-500">
                                    No connected accounts for this content. <Link href="/social/accounts?action=connect" className="text-blue-950 hover:underline">Connect one</Link>.
                                </p>
                            ) : (
                                <select
                                    value={selectedAccountId}
                                    onChange={(e) => setSelectedAccountId(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-950/20"
                                >
                                    <option value="">Select account…</option>
                                    {eligibleAccounts.map((a) => (
                                        <option key={a.account_id} value={a.account_id}>
                                            {PLATFORM_META[a.platform].label} · {a.account_name ?? a.account_id} {!a.can_publish ? '(cannot publish)' : ''}
                                        </option>
                                    ))}
                                </select>
                            )}

                            {selectedAccount && selectedAccount.publishing_restrictions?.length ? (
                                <ul className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 space-y-0.5">
                                    {selectedAccount.publishing_restrictions.map((r) => (
                                        <li key={r} className="flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{r}</li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                    </section>

                    <section className="border border-slate-200 rounded">
                        <h4 className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 border-b border-slate-100 uppercase tracking-wide">
                            3. Date &amp; time
                        </h4>
                        <div className="p-2.5 space-y-2">
                            <input
                                type="datetime-local"
                                value={scheduledAt}
                                onChange={(e) => setScheduledAt(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-950/20"
                            />
                            {needsReminder && (
                                <div className="bg-amber-50 border border-amber-200 rounded px-2.5 py-2 text-[12px] text-amber-800 space-y-1.5">
                                    <p className="flex items-start gap-1.5">
                                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                        This account cannot publish this content type right now. You can schedule a manual publishing reminder instead — it will not auto-publish.
                                    </p>
                                    <label className="inline-flex items-center gap-1.5">
                                        <input type="checkbox" checked={asReminder} onChange={(e) => setAsReminder(e.target.checked)} className="accent-amber-600" />
                                        <span>Create as manual reminder</span>
                                    </label>
                                </div>
                            )}
                            <p className="text-[11px] text-slate-500">
                                Times are stored in your business time zone. You can change this later.
                            </p>
                        </div>
                    </section>
                </div>

                <footer className="border-t border-slate-100 px-3 py-2 flex items-center justify-end gap-1.5">
                    <button type="button" onClick={onClose} className="px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[12px] text-slate-700">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => void submit()}
                        disabled={!selectedContent || !selectedAccount || !scheduledAt || needsReminder || busy}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-blue-950 hover:bg-blue-900 text-white text-[12px] font-medium disabled:opacity-50"
                    >
                        {busy ? <Spinner /> : <CalendarDays className="w-3.5 h-3.5" />}
                        {asReminder ? 'Schedule reminder' : 'Schedule post'}
                    </button>
                </footer>
            </div>
        </div>
    );
}

function MonthGrid({
    anchor,
    grouped,
    tz,
    onOpen,
    onDrop,
    setDragTarget,
    dragTarget,
}: {
    anchor: Date;
    grouped: Map<string, ScheduledPost[]>;
    tz: string | null;
    onOpen: (id: string) => void;
    onDrop: (date: Date, postId: string) => void;
    setDragTarget: (key: string | null) => void;
    dragTarget: string | null;
}) {
    const first = startOfMonth(anchor);
    const start = startOfWeek(first);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) cells.push(addDays(start, i));

    const today = new Date();

    return (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="px-2 py-1.5 text-[11px] font-medium text-slate-600 text-center">{d}</div>
                ))}
            </div>
            <div className="grid grid-cols-7">
                {cells.map((cell, i) => {
                    const key = ymd(cell);
                    const inMonth = cell.getMonth() === anchor.getMonth();
                    const list = grouped.get(key) ?? [];
                    const isToday = sameDay(cell, today);
                    const isDragTarget = dragTarget === key;
                    return (
                        <div
                            key={`${key}-${i}`}
                            onDragOver={(e) => { e.preventDefault(); setDragTarget(key); }}
                            onDragLeave={() => { if (dragTarget === key) setDragTarget(null); }}
                            onDrop={(e) => {
                                const id = e.dataTransfer.getData('text/post-id');
                                setDragTarget(null);
                                if (id) onDrop(cell, id);
                            }}
                            className={`min-h-[110px] border-b border-r border-slate-100 p-1 ${inMonth ? 'bg-white' : 'bg-slate-50/60'} ${isToday ? 'ring-1 ring-inset ring-blue-950/30' : ''} ${isDragTarget ? 'bg-blue-50/50' : ''}`}
                        >
                            <div className={`text-[11px] font-medium ${inMonth ? 'text-slate-700' : 'text-slate-400'} mb-1`}>
                                {cell.getDate()}
                            </div>
                            <div className="space-y-0.5">
                                {list.slice(0, 3).map((p) => (
                                    <CalendarEventChip key={p.id} post={p} tz={tz} onClick={() => onOpen(p.id)} compact />
                                ))}
                                {list.length > 3 && (
                                    <button type="button" onClick={() => list[3] && onOpen(list[3].id)} className="text-[10px] text-slate-500 hover:underline">
                                        +{list.length - 3} more
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function WeekGrid({
    anchor,
    grouped,
    tz,
    onOpen,
    onDrop,
    setDragTarget,
    dragTarget,
}: {
    anchor: Date;
    grouped: Map<string, ScheduledPost[]>;
    tz: string | null;
    onOpen: (id: string) => void;
    onDrop: (date: Date, postId: string) => void;
    setDragTarget: (key: string | null) => void;
    dragTarget: string | null;
}) {
    const start = startOfWeek(anchor);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const today = new Date();

    return (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
                {days.map((d) => {
                    const isToday = sameDay(d, today);
                    return (
                        <div key={ymd(d)} className={`px-2 py-1.5 text-[11px] font-medium text-center ${isToday ? 'text-blue-950' : 'text-slate-600'}`}>
                            {d.toLocaleDateString(undefined, { weekday: 'short' })}{' '}
                            <span className={isToday ? 'font-semibold' : ''}>{d.getDate()}</span>
                        </div>
                    );
                })}
            </div>
            <div className="grid grid-cols-7">
                {days.map((d) => {
                    const key = ymd(d);
                    const list = grouped.get(key) ?? [];
                    const isDragTarget = dragTarget === key;
                    return (
                        <div
                            key={key}
                            onDragOver={(e) => { e.preventDefault(); setDragTarget(key); }}
                            onDragLeave={() => { if (dragTarget === key) setDragTarget(null); }}
                            onDrop={(e) => {
                                const id = e.dataTransfer.getData('text/post-id');
                                setDragTarget(null);
                                if (id) onDrop(d, id);
                            }}
                            className={`min-h-[320px] border-b border-r border-slate-100 p-1 ${isDragTarget ? 'bg-blue-50/50' : ''}`}
                        >
                            <div className="space-y-1">
                                {list.map((p) => (
                                    <CalendarEventChip key={p.id} post={p} tz={tz} onClick={() => onOpen(p.id)} compact />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function DayList({ anchor, posts, tz, onOpen }: { anchor: Date; posts: ScheduledPost[]; tz: string | null; onOpen: (id: string) => void }) {
    const list = posts.filter((p) => sameDay(new Date(p.scheduled_at), anchor));
    return (
        <div className="bg-white border border-slate-200 rounded">
            <div className="px-3 py-2 border-b border-slate-100 text-[12px] font-medium text-slate-700">
                {anchor.toLocaleDateString(undefined, { dateStyle: 'full' })}
            </div>
            {list.length === 0 ? (
                <div className="p-6 text-center text-[12px] text-slate-500">No posts scheduled for this day.</div>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {list.map((p) => {
                        const pm = PLATFORM_META[p.platform];
                        const Icon = pm.icon;
                        return (
                            <li key={p.id}>
                                <button type="button" onClick={() => onOpen(p.id)} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5">
                                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded ${pm.brand}`}><Icon className="w-4 h-4" /></span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[12px] font-medium text-slate-900 truncate">{p.content_title}</span>
                                        <span className="block text-[11px] text-slate-500 truncate">
                                            {formatTime(p.scheduled_at, tz)} · {pm.label} · {p.account_name ?? '—'}
                                        </span>
                                    </span>
                                    <StatusBadge status={p.status} />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

function AgendaList({ posts, tz, onOpen }: { posts: ScheduledPost[]; tz: string | null; onOpen: (id: string) => void }) {
    const sorted = [...posts].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    return (
        <div className="bg-white border border-slate-200 rounded">
            <ul className="divide-y divide-slate-100">
                {sorted.map((p) => {
                    const pm = PLATFORM_META[p.platform];
                    const Icon = pm.icon;
                    return (
                        <li key={p.id}>
                            <button type="button" onClick={() => onOpen(p.id)} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5">
                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded ${pm.brand}`}><Icon className="w-4 h-4" /></span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[12px] font-medium text-slate-900 truncate">{p.content_title}</span>
                                    <span className="block text-[11px] text-slate-500 truncate">
                                        {formatDateTime(p.scheduled_at, tz)} · {pm.label} · {p.account_name ?? '—'}
                                        {p.campaign_name ? ` · ${p.campaign_name}` : ''}
                                    </span>
                                </span>
                                <StatusBadge status={p.status} />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function PublishingCalendarPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [me, setMe] = useState<Me | null>(null);
    const [view, setView] = useState<CalendarView>('month');
    const [anchor, setAnchor] = useState<Date>(new Date());

    const [posts, setPosts] = useState<ScheduledPost[] | null>(null);
    const [tz, setTz] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [platformFilter, setPlatformFilter] = useState<PlatformKey | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<PublishStatus | 'all'>('all');
    const [accountFilter, setAccountFilter] = useState<string>('all');
    const [campaignFilter, setCampaignFilter] = useState<string>('all');
    const [ownerFilter, setOwnerFilter] = useState<string>('all');
    const [query, setQuery] = useState('');

    const [capabilities, setCapabilities] = useState<AccountCapability[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [staff, setStaff] = useState<StaffMember[]>([]);

    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [scheduleInitialDate, setScheduleInitialDate] = useState<Date>(new Date());
    const [openPostId, setOpenPostId] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [dragTarget, setDragTarget] = useState<string | null>(null);
    const [pendingReschedule, setPendingReschedule] = useState<{ postId: string; date: string } | null>(null);

    const range = useMemo(() => {
        if (view === 'month') {
            return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
        }
        if (view === 'week') {
            const from = startOfWeek(anchor);
            return { from, to: addDays(from, 6) };
        }
        if (view === 'day') {
            const from = new Date(anchor); from.setHours(0, 0, 0, 0);
            const to = new Date(anchor); to.setHours(23, 59, 59, 999);
            return { from, to };
        }
        return { from: new Date(), to: addDays(new Date(), 30) };
    }, [view, anchor]);

    const load = useCallback(async (silent = false) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            const res = await listScheduledPostsRequest({
                from: ymd(range.from),
                to: ymd(range.to),
                platform: platformFilter,
                status: statusFilter,
                account_id: accountFilter,
                campaign_id: campaignFilter,
                owner_id: ownerFilter,
                q: query.trim() || undefined,
            });
            setPosts(res.posts ?? []);
            if (res.time_zone) setTz(res.time_zone);
        } catch (err) {
            if (err instanceof ApiError) setError(detailOf(err) ?? 'Could not load calendar.');
            else if (err instanceof Error) setError(err.message);
            else setError('Could not load calendar.');
            setPosts(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [range, platformFilter, statusFilter, accountFilter, campaignFilter, ownerFilter, query]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const m = await api.me();
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
                if (typeof c.social?.accounts?.capabilities === 'function') {
                    const res = await c.social.accounts.capabilities();
                    if (!cancelled && res?.accounts) setCapabilities(res.accounts);
                } else {
                    const res =
                        typeof c.social?.accounts?.list === 'function'
                            ? await c.social.accounts.list()
                            : typeof c.getSocialAccounts === 'function'
                                ? await c.getSocialAccounts()
                                : null;
                    if (!cancelled && res?.accounts) {
                        setCapabilities(
                            res.accounts.map((a) => ({
                                account_id: a.id,
                                account_name: a.account_name ?? a.display_name ?? a.username ?? null,
                                platform: a.platform,
                                status: a.status,
                                can_publish: a.status === 'connected',
                                publishing_formats: a.publishing_formats,
                                publishing_restrictions: a.publishing_restrictions,
                            })),
                        );
                    }
                }
            } catch {
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        const action = searchParams.get('action');
        const dateStr = searchParams.get('date');
        const id = searchParams.get('id');
        if (action === 'schedule') {
            if (dateStr) {
                const d = new Date(dateStr);
                if (!Number.isNaN(d.getTime())) { setScheduleInitialDate(d); setAnchor(d); }
            }
            setScheduleOpen(true);
        }
        if (id) setOpenPostId(id);
    }, [searchParams]);

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
        if (Array.isArray(m.permissions) && m.permissions.some((p) => ['manage_social_content', 'manage_social_schedule'].includes(p))) return true;
        return false;
    }, [me]);

    const canCancel = canEdit;

    const filteredPosts = posts ?? [];

    const openPost = useMemo(
        () => (posts ?? []).find((p) => p.id === openPostId) ?? null,
        [posts, openPostId],
    );

    const groupedByDay = useMemo(() => {
        const map = new Map<string, ScheduledPost[]>();
        for (const p of filteredPosts) {
            const d = new Date(p.scheduled_at);
            const key = ymd(d);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(p);
        }
        for (const list of map.values()) {
            list.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
        }
        return map;
    }, [filteredPosts]);

    const queueSummary = useMemo(() => {
        const s = { scheduled: 0, pending: 0, failed: 0, published: 0 };
        for (const p of filteredPosts) {
            if (['approved', 'scheduled', 'queued'].includes(p.status)) s.scheduled++;
            else if (p.status === 'pending_approval') s.pending++;
            else if (p.status === 'failed') s.failed++;
            else if (p.status === 'published') s.published++;
        }
        return s;
    }, [filteredPosts]);

    const navigate = (dir: -1 | 1) => {
        if (view === 'month') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
        else if (view === 'week') setAnchor(addDays(anchor, 7 * dir));
        else if (view === 'day') setAnchor(addDays(anchor, dir));
        else setAnchor(addDays(anchor, 30 * dir));
    };

    const goToday = () => setAnchor(new Date());

    const handleDrop = (date: Date, postId: string) => {
        if (!canEdit) return;
        const target = (posts ?? []).find((p) => p.id === postId);
        if (!target || !EDITABLE_STATUSES.includes(target.status)) return;
        const orig = new Date(target.scheduled_at);
        const next = new Date(date);
        next.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
        setPendingReschedule({ postId, date: next.toISOString() });
    };

    const confirmReschedule = async () => {
        if (!pendingReschedule) return;
        try {
            const updated = await reschedulePostRequest(pendingReschedule.postId, pendingReschedule.date);
            setPosts((list) => (list ? list.map((x) => (x.id === updated.id ? updated : x)) : list));
        } catch (err) {
            if (err instanceof ApiError) setError(detailOf(err) ?? 'Reschedule failed.');
            else if (err instanceof Error) setError(err.message);
            else setError('Reschedule failed.');
        } finally {
            setPendingReschedule(null);
        }
    };

    const viewTabs: { key: CalendarView; label: string; icon: LucideIcon }[] = [
        { key: 'month', label: 'Month', icon: CalendarIcon },
        { key: 'week', label: 'Week', icon: Grid3x3 },
        { key: 'day', label: 'Day', icon: CalendarDays },
        { key: 'agenda', label: 'Agenda', icon: LayoutList },
    ];

    return (
        <div className="space-y-3">
            <header className="bg-white border border-slate-200 rounded p-3 sm:p-4 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-[18px] font-semibold text-slate-900">Publishing Calendar</h1>
                        <p className="text-[12px] sm:text-[13px] text-slate-500">
                            Plan, schedule and monitor publications across YouTube, Facebook, Instagram and TikTok.
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            onClick={() => { setScheduleInitialDate(anchor); setScheduleOpen(true); }}
                            disabled={!canEdit}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-blue-950 hover:bg-blue-900 text-white text-[12px] font-medium disabled:opacity-50"
                        >
                            <Plus className="w-3.5 h-3.5" /> Schedule post
                        </button>
                        <button
                            type="button"
                            onClick={goToday}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[12px] text-slate-700"
                        >
                            <CalendarIcon className="w-3.5 h-3.5" /> Today
                        </button>
                        <button
                            type="button"
                            onClick={() => void load(true)}
                            disabled={refreshing}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[12px] text-slate-700 disabled:opacity-50"
                        >
                            {refreshing ? <Spinner /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                        <button type="button" onClick={() => navigate(-1)} className="w-7 h-7 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center" aria-label="Previous">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="text-[13px] font-medium text-slate-900 min-w-[160px] text-center">
                            {view === 'month' && anchor.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
                            {view === 'week' && `Week of ${startOfWeek(anchor).toLocaleDateString()}`}
                            {view === 'day' && anchor.toLocaleDateString(undefined, { dateStyle: 'full' })}
                            {view === 'agenda' && 'Next 30 days'}
                        </div>
                        <button type="button" onClick={() => navigate(1)} className="w-7 h-7 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center" aria-label="Next">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="inline-flex rounded border border-slate-200 bg-white overflow-hidden">
                        {viewTabs.map((t) => (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setView(t.key)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium transition ${view === t.key ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <t.icon className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{t.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="bg-slate-50 border border-slate-100 rounded px-2.5 py-1.5">
                        <div className="text-slate-500">Scheduled</div>
                        <div className="text-[15px] font-semibold text-slate-900">{queueSummary.scheduled}</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded px-2.5 py-1.5">
                        <div className="text-slate-500">Pending approval</div>
                        <div className="text-[15px] font-semibold text-blue-700">{queueSummary.pending}</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded px-2.5 py-1.5">
                        <div className="text-slate-500">Failed</div>
                        <div className="text-[15px] font-semibold text-rose-700">{queueSummary.failed}</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded px-2.5 py-1.5">
                        <div className="text-slate-500">Published</div>
                        <div className="text-[15px] font-semibold text-emerald-700">{queueSummary.published}</div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Clock className="w-3 h-3" />
                    Time zone: <span className="text-slate-700 font-medium">{tz ?? 'Server default'}</span>
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
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search title, caption, account"
                        className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-950/20"
                    />
                </div>
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value as PlatformKey | 'all')} className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-700">
                    <option value="all">All platforms</option>
                    {PLATFORM_ORDER.map((p) => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PublishStatus | 'all')} className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-700">
                    <option value="all">All statuses</option>
                    {Object.keys(STATUS_META).map((s) => <option key={s} value={s}>{STATUS_META[s as PublishStatus].label}</option>)}
                </select>
                <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-700">
                    <option value="all">All accounts</option>
                    {capabilities.map((c) => <option key={c.account_id} value={c.account_id}>{c.account_name ?? c.account_id}</option>)}
                </select>
                <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-700">
                    <option value="all">All campaigns</option>
                    {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-700">
                    <option value="all">All staff</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="bg-white border border-slate-200 rounded p-6 text-center text-[12px] text-slate-500">
                    <div className="inline-flex items-center gap-1.5"><Spinner /> Loading calendar…</div>
                </div>
            ) : !posts ? null : filteredPosts.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded p-6 text-center">
                    <div className="w-12 h-12 mx-auto rounded-full bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center">
                        <CalendarDays className="w-5 h-5" />
                    </div>
                    <h3 className="mt-2 text-[13px] font-semibold text-slate-900">Nothing scheduled in this range</h3>
                    <p className="text-[12px] text-slate-500 mt-1 max-w-md mx-auto">
                        Schedule a post from Content Studio or click &quot;Schedule post&quot; above.
                    </p>
                    <button type="button" onClick={() => { setScheduleInitialDate(anchor); setScheduleOpen(true); }} disabled={!canEdit} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-950 text-white text-[12px] font-medium disabled:opacity-50">
                        <Plus className="w-3.5 h-3.5" /> Schedule post
                    </button>
                </div>
            ) : view === 'month' ? (
                <MonthGrid anchor={anchor} grouped={groupedByDay} tz={tz} onOpen={(id) => setOpenPostId(id)} onDrop={handleDrop} setDragTarget={setDragTarget} dragTarget={dragTarget} />
            ) : view === 'week' ? (
                <WeekGrid anchor={anchor} grouped={groupedByDay} tz={tz} onOpen={(id) => setOpenPostId(id)} onDrop={handleDrop} setDragTarget={setDragTarget} dragTarget={dragTarget} />
            ) : view === 'day' ? (
                <DayList anchor={anchor} posts={filteredPosts} tz={tz} onOpen={(id) => setOpenPostId(id)} />
            ) : (
                <AgendaList posts={filteredPosts} tz={tz} onOpen={(id) => setOpenPostId(id)} />
            )}

            <ScheduleModal
                open={scheduleOpen}
                initialDate={scheduleInitialDate}
                capabilities={capabilities}
                onClose={() => { setScheduleOpen(false); router.replace('/social/publishing-calendar'); }}
                onScheduled={(p) => { setPosts((list) => (list ? [p, ...list] : [p])); }}
            />

            {openPost && (
                <PostDrawer
                    post={openPost}
                    tz={tz}
                    canEdit={canEdit}
                    canCancel={canCancel}
                    onClose={() => { setOpenPostId(null); router.replace('/social/publishing-calendar'); }}
                    onChanged={(p) => {
                        setPosts((list) => (list && p ? list.map((x) => (x.id === p.id ? p : x)) : list));
                        setOpenPostId(p ? p.id : null);
                    }}
                />
            )}

            {pendingReschedule && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-3">
                    <div className="w-full max-w-sm bg-white border border-slate-200 rounded shadow-xl">
                        <div className="px-3 py-2.5 border-b border-slate-100">
                            <h3 className="text-[13px] font-semibold text-slate-900">Confirm reschedule</h3>
                        </div>
                        <div className="p-3 text-[12px] text-slate-700">
                            Move this post to {formatDateTime(pendingReschedule.date, tz)}?
                            This will update the backend schedule.
                        </div>
                        <div className="px-3 py-2 border-t border-slate-100 flex justify-end gap-1.5">
                            <button type="button" onClick={() => setPendingReschedule(null)} className="px-2.5 py-1.5 rounded border border-slate-200 bg-white text-[12px] text-slate-700">Cancel</button>
                            <button type="button" onClick={() => void confirmReschedule()} className="px-2.5 py-1.5 rounded bg-blue-950 text-white text-[12px] font-medium">Apply</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PublishingCalendarPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-[300px] flex items-center justify-center p-6">
                    <div className="flex items-center gap-2 text-slate-500 text-[13px]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading Publishing Calendar…
                    </div>
                </div>
            }
        >
            <PublishingCalendarPageContent />
        </Suspense>
    );
}