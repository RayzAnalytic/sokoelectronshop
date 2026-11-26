'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    AlertTriangle,
    Check,
    CheckCircle2,
    ChevronRight,
    Clock,
    ExternalLink,
    Filter,
    KeyRound,
    Loader2,
    Lock,
    Plus,
    RefreshCw,
    Search,
    ShieldAlert,
    ShieldCheck,
    Star,
    Trash2,
    UserPlus,
    Users,
    X,
    XCircle,
} from 'lucide-react';
import { type IconType } from 'react-icons';
import { FaFacebook, FaInstagram, FaTiktok, FaYoutube } from 'react-icons/fa';
import { adminApi as api } from '@/lib/admin-api';
import { ApiError, type Me } from '@/lib/api';

type PlatformKey = 'youtube' | 'facebook' | 'instagram' | 'tiktok';

type ConnectionStatus =
    | 'connected'
    | 'not_connected'
    | 'connecting'
    | 'authorization_expired'
    | 'permission_required'
    | 'sync_failed'
    | 'temporarily_unavailable';

type AccountScope = {
    key: string;
    label: string;
    granted: boolean;
};

type SyncHistoryEntry = {
    at: string;
    status: 'success' | 'failure';
    message?: string | null;
};

type StaffShare = {
    staff_id: string;
    staff_name?: string | null;
    permissions: Array<'publish' | 'inbox' | 'analytics' | string>;
};

type SocialAccount = {
    id: string;
    platform: PlatformKey;
    status: ConnectionStatus;
    display_name?: string | null;
    username?: string | null;
    profile_image_url?: string | null;
    account_type?: string | null;
    account_id?: string | null;
    followers?: number | null;
    connected_at?: string | null;
    last_synced_at?: string | null;
    last_failed_sync_at?: string | null;
    next_sync_at?: string | null;
    error?: string | null;
    scopes?: AccountScope[];
    missing_scopes?: string[];
    token_expires_at?: string | null;
    last_auth_check_at?: string | null;
    sync_history?: SyncHistoryEntry[];
    is_default_publishing?: boolean;
    enabled_for_distribution?: boolean;
    label?: string | null;
    shares?: StaffShare[];
    publishing_formats?: string[];
    publishing_restrictions?: string[];
    sync_status?: 'ok' | 'failed' | 'pending' | 'never';
    coverage_start?: string | null;
    coverage_end?: string | null;
    missing_metrics?: string[];
};

const PLATFORM_META: Record<
    PlatformKey,
    { label: string; icon: IconType; brand: string; help: string }
> = {
    youtube: {
        label: 'YouTube',
        icon: FaYoutube,
        brand: 'text-rose-600 bg-rose-50',
        help: 'Connect the YouTube channel you publish for. Read access is used for analytics; write access is required for publishing.',
    },
    facebook: {
        label: 'Facebook',
        icon: FaFacebook,
        brand: 'text-blue-700 bg-blue-50',
        help: 'Connect the Facebook Page (not a personal profile) you manage. Page management and insights permissions are requested.',
    },
    instagram: {
        label: 'Instagram',
        icon: FaInstagram,
        brand: 'text-pink-600 bg-pink-50',
        help: 'Instagram Business or Creator accounts only. Personal accounts must be converted before connecting.',
    },
    tiktok: {
        label: 'TikTok',
        icon: FaTiktok,
        brand: 'text-slate-900 bg-slate-100',
        help: 'If TikTok Business is already linked, this integration reuses the same authorized account — you will not connect twice.',
    },
};

const PLATFORM_ORDER: PlatformKey[] = ['youtube', 'facebook', 'instagram', 'tiktok'];

const STATUS_FILTERS: { key: ConnectionStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'All statuses' },
    { key: 'connected', label: 'Connected' },
    { key: 'not_connected', label: 'Not connected' },
    { key: 'authorization_expired', label: 'Authorization expired' },
    { key: 'permission_required', label: 'Permission required' },
    { key: 'sync_failed', label: 'Sync failed' },
    { key: 'temporarily_unavailable', label: 'Unavailable' },
];

function detailOf(err: ApiError): string | null {
    if (typeof err.data === 'object' && err.data && 'detail' in err.data) {
        const d = (err.data as { detail: unknown }).detail;
        if (typeof d === 'string') return d;
    }
    return null;
}

function fmtNum(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

function formatRelative(iso: string | null | undefined): string {
    if (!iso) return 'Never';
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return 'Never';
    const diff = Date.now() - t;
    if (diff < 0) return 'Scheduled';
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
}

function statusMeta(status: ConnectionStatus) {
    switch (status) {
        case 'connected':
            return { label: 'Connected', chip: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500', warn: false, canPublish: true, canSync: true };
        case 'connecting':
            return { label: 'Connecting…', chip: 'bg-blue-50 border-blue-200 text-blue-700', dot: 'bg-blue-500 animate-pulse', warn: false, canPublish: false, canSync: false };
        case 'not_connected':
            return { label: 'Not connected', chip: 'bg-slate-50 border-slate-200 text-slate-500', dot: 'bg-slate-300', warn: false, canPublish: false, canSync: false };
        case 'authorization_expired':
            return { label: 'Authorization expired', chip: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-500', warn: true, canPublish: false, canSync: false };
        case 'permission_required':
            return { label: 'Permission required', chip: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-500', warn: true, canPublish: false, canSync: true };
        case 'sync_failed':
            return { label: 'Sync failed', chip: 'bg-rose-50 border-rose-200 text-rose-700', dot: 'bg-rose-500', warn: true, canPublish: false, canSync: true };
        case 'temporarily_unavailable':
        default:
            return { label: 'Temporarily unavailable', chip: 'bg-slate-50 border-slate-200 text-slate-600', dot: 'bg-slate-400', warn: true, canPublish: false, canSync: true };
    }
}

function permissionsSummary(a: SocialAccount): { granted: number; missing: number } {
    const granted = (a.scopes ?? []).filter((s) => s.granted).length;
    const missing = (a.scopes ?? []).filter((s) => !s.granted).length + (a.missing_scopes?.length ?? 0);
    return { granted, missing };
}

type SocialApiClient = {
    social?: {
        accounts?: {
            list?: () => Promise<{ accounts: SocialAccount[] }>;
            connect?: (platform: PlatformKey) => Promise<{ authorize_url: string }>;
            reauthorize?: (id: string) => Promise<{ authorize_url: string }>;
            sync?: (id: string) => Promise<{ ok: boolean }>;
            disconnect?: (id: string) => Promise<{ ok: boolean }>;
            update?: (
                id: string,
                patch: Partial<Pick<SocialAccount, 'label' | 'is_default_publishing' | 'enabled_for_distribution'>>,
            ) => Promise<SocialAccount>;
        };
    };
    getSocialAccounts?: () => Promise<{ accounts: SocialAccount[] }>;
    startSocialConnect?: (q: { platform: PlatformKey }) => Promise<{ authorize_url: string }>;
    reauthorizeSocialAccount?: (id: string) => Promise<{ authorize_url: string }>;
    syncSocialAccount?: (id: string) => Promise<{ ok: boolean }>;
    disconnectSocialAccount?: (id: string) => Promise<{ ok: boolean }>;
    updateSocialAccount?: (
        id: string,
        patch: Partial<Pick<SocialAccount, 'label' | 'is_default_publishing' | 'enabled_for_distribution'>>,
    ) => Promise<SocialAccount>;
};

const clientApi = () => api as unknown as SocialApiClient;

async function fetchAccounts(): Promise<SocialAccount[]> {
    const c = clientApi();
    if (typeof c.social?.accounts?.list === 'function') {
        const res = await c.social.accounts.list();
        return Array.isArray(res?.accounts) ? res.accounts : [];
    }
    if (typeof c.getSocialAccounts === 'function') {
        const res = await c.getSocialAccounts();
        return Array.isArray(res?.accounts) ? res.accounts : [];
    }
    throw new Error('Accounts endpoint is not available.');
}

async function startConnect(platform: PlatformKey): Promise<string> {
    const c = clientApi();
    const res =
        typeof c.social?.accounts?.connect === 'function'
            ? await c.social.accounts.connect(platform)
            : typeof c.startSocialConnect === 'function'
                ? await c.startSocialConnect({ platform })
                : null;
    if (!res?.authorize_url) throw new Error('Authorization URL missing from backend response.');
    return res.authorize_url;
}

async function reauthorize(id: string): Promise<string> {
    const c = clientApi();
    const res =
        typeof c.social?.accounts?.reauthorize === 'function'
            ? await c.social.accounts.reauthorize(id)
            : typeof c.reauthorizeSocialAccount === 'function'
                ? await c.reauthorizeSocialAccount(id)
                : null;
    if (!res?.authorize_url) throw new Error('Authorization URL missing from backend response.');
    return res.authorize_url;
}

async function syncAccount(id: string): Promise<void> {
    const c = clientApi();
    if (typeof c.social?.accounts?.sync === 'function') {
        await c.social.accounts.sync(id);
        return;
    }
    if (typeof c.syncSocialAccount === 'function') {
        await c.syncSocialAccount(id);
        return;
    }
    throw new Error('Sync endpoint is not available.');
}

async function disconnectAccount(id: string): Promise<void> {
    const c = clientApi();
    if (typeof c.social?.accounts?.disconnect === 'function') {
        await c.social.accounts.disconnect(id);
        return;
    }
    if (typeof c.disconnectSocialAccount === 'function') {
        await c.disconnectSocialAccount(id);
        return;
    }
    throw new Error('Disconnect endpoint is not available.');
}

async function updateAccount(
    id: string,
    patch: Partial<Pick<SocialAccount, 'label' | 'is_default_publishing' | 'enabled_for_distribution'>>,
): Promise<void> {
    const c = clientApi();
    if (typeof c.social?.accounts?.update === 'function') {
        await c.social.accounts.update(id, patch);
        return;
    }
    if (typeof c.updateSocialAccount === 'function') {
        await c.updateSocialAccount(id, patch);
        return;
    }
    throw new Error('Update endpoint is not available.');
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
    const sm = statusMeta(status);
    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] ${sm.chip}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
            {sm.label}
        </span>
    );
}

function AccountCard({
    account,
    onOpen,
    onSync,
    busy,
}: {
    account: SocialAccount;
    onOpen: () => void;
    onSync: () => void;
    busy: boolean;
}) {
    const meta = PLATFORM_META[account.platform];
    const Icon = meta.icon;
    const sm = statusMeta(account.status);
    const perm = permissionsSummary(account);

    return (
        <div className="bg-white border border-slate-200 rounded p-3 space-y-2.5">
            <div className="flex items-start gap-2.5">
                <div className="w-10 h-10 rounded bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {account.profile_image_url ? (
                        <img src={account.profile_image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className={`inline-flex items-center justify-center w-full h-full ${meta.brand}`}>
                            <Icon className="w-5 h-5" />
                        </span>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-slate-900 truncate">
                            {account.display_name || account.username || meta.label}
                        </span>
                        {account.is_default_publishing && (
                            <span title="Default publishing account" className="text-amber-500">
                                <Star className="w-3.5 h-3.5 fill-current" />
                            </span>
                        )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                        {account.username ? `@${account.username.replace(/^@/, '')}` : '—'}
                        {account.account_type ? ` · ${account.account_type}` : ''}
                        {account.label ? ` · ${account.label}` : ''}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <StatusBadge status={account.status} />
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                            <Icon className="w-3 h-3" />
                            {meta.label}
                        </span>
                        {account.followers !== null && account.followers !== undefined && (
                            <span className="text-[11px] text-slate-500">
                                {fmtNum(account.followers)} followers
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-50 border border-slate-100 rounded px-2 py-1.5">
                    <div className="text-slate-500">Last sync</div>
                    <div className="text-slate-800 font-medium">{formatRelative(account.last_synced_at)}</div>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded px-2 py-1.5">
                    <div className="text-slate-500">Permissions</div>
                    <div className={`font-medium ${perm.missing > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {perm.granted} granted{perm.missing > 0 ? ` · ${perm.missing} missing` : ''}
                    </div>
                </div>
            </div>

            {sm.warn && account.error && (
                <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span className="min-w-0">{account.error}</span>
                </div>
            )}

            <div className="flex items-center justify-between gap-1.5">
                <button
                    type="button"
                    onClick={onOpen}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700"
                >
                    Manage
                    <ChevronRight className="w-3 h-3" />
                </button>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onSync}
                        disabled={busy || !sm.canSync}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={sm.canSync ? 'Sync now' : 'Not available for this status'}
                    >
                        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Sync
                    </button>
                    {account.status === 'authorization_expired' || account.status === 'permission_required' ? (
                        <button
                            type="button"
                            onClick={onOpen}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-[11px] font-medium text-amber-800"
                        >
                            <KeyRound className="w-3 h-3" />
                            Reauthorize
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function ConnectModal({
    open,
    initialPlatform,
    onClose,
    onStarted,
    canManage,
}: {
    open: boolean;
    initialPlatform: PlatformKey | null;
    onClose: () => void;
    onStarted: (platform: PlatformKey) => void;
    canManage: boolean;
}) {
    const [platform, setPlatform] = useState<PlatformKey>(initialPlatform ?? 'youtube');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (initialPlatform) setPlatform(initialPlatform);
    }, [initialPlatform]);

    useEffect(() => {
        if (!open) {
            setSubmitting(false);
            setError(null);
        }
    }, [open]);

    if (!open) return null;

    const meta = PLATFORM_META[platform];
    const Icon = meta.icon;

    const handleStart = async () => {
        if (!canManage) {
            setError('You do not have permission to connect social accounts.');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const authorizeUrl = await startConnect(platform);
            onStarted(platform);
            window.location.href = authorizeUrl;
        } catch (err: any) {
            if (err instanceof ApiError) setError(detailOf(err) ?? 'Could not start authorization.');
            else if (err instanceof Error) setError(err.message);
            else setError('Could not start authorization.');
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-3">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded shadow-xl">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100">
                    <h3 className="text-[13px] font-semibold text-slate-900">Connect account</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-50"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-3 space-y-3">
                    <div className="space-y-1">
                        <label className="block text-[12px] font-medium text-slate-700">
                            1. Choose a platform
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {PLATFORM_ORDER.map((p) => {
                                const pm = PLATFORM_META[p];
                                const PIcon = pm.icon;
                                const active = platform === p;
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPlatform(p)}
                                        disabled={submitting}
                                        className={`flex items-center gap-2 px-2.5 py-2 rounded border text-[12px] transition ${active
                                            ? 'border-blue-950 bg-blue-950/5 text-slate-900'
                                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                            }`}
                                    >
                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded ${pm.brand}`}>
                                            <PIcon className="w-3.5 h-3.5" />
                                        </span>
                                        <span className="font-medium">{pm.label}</span>
                                        {active && <Check className="w-3 h-3 ml-auto text-blue-950" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded p-2.5 text-[12px] text-slate-600 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            <Icon className="w-3.5 h-3.5" />
                            2. What we&apos;ll request
                        </div>
                        <p>{meta.help}</p>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-500">
                            <li>Read access to account profile and analytics</li>
                            <li>Publishing permissions where the platform allows it</li>
                            <li>Comment and message access where supported</li>
                        </ul>
                        <p className="text-[11px] text-slate-500">
                            You will be redirected to {meta.label}&apos;s official authorization screen.
                            We never ask for your password.
                        </p>
                    </div>

                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded px-2.5 py-2 text-[12px] text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-1.5">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[12px] text-slate-700 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleStart()}
                            disabled={submitting || !canManage}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-950 hover:bg-blue-900 text-white text-[12px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                            Continue to {meta.label}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Row({
    label,
    value,
    mono,
    valueClass,
}: {
    label: string;
    value: React.ReactNode;
    mono?: boolean;
    valueClass?: string;
}) {
    return (
        <div className="flex items-baseline justify-between gap-2">
            <dt className="text-slate-500 shrink-0">{label}</dt>
            <dd className={`text-right truncate ${mono ? 'font-mono text-[11px]' : ''} ${valueClass ?? 'text-slate-800'}`}>
                {value}
            </dd>
        </div>
    );
}

function AccountDrawer({
    account,
    onClose,
    onChanged,
    canManage,
}: {
    account: SocialAccount | null;
    onClose: () => void;
    onChanged: () => void;
    canManage: boolean;
}) {
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [confirmDisconnect, setConfirmDisconnect] = useState(false);
    const [label, setLabel] = useState(account?.label ?? '');

    useEffect(() => {
        setLabel(account?.label ?? '');
        setError(null);
        setConfirmDisconnect(false);
    }, [account?.id, account?.label]);

    if (!account) return null;

    const meta = PLATFORM_META[account.platform];
    const Icon = meta.icon;
    const sm = statusMeta(account.status);
    const perm = permissionsSummary(account);

    const run = async (key: string, fn: () => Promise<void>) => {
        setBusy(key);
        setError(null);
        try {
            await fn();
            onChanged();
        } catch (err: any) {
            if (err instanceof ApiError) setError(detailOf(err) ?? 'Action failed.');
            else if (err instanceof Error) setError(err.message);
            else setError('Action failed.');
        } finally {
            setBusy(null);
        }
    };

    const handleReauthorize = () =>
        run('reauth', async () => {
            const url = await reauthorize(account.id);
            window.location.href = url;
        });

    const handleSync = () => run('sync', () => syncAccount(account.id));

    const handleDisconnect = () =>
        run('disconnect', async () => {
            await disconnectAccount(account.id);
            setConfirmDisconnect(false);
            onClose();
            onChanged();
        });

    const handleSaveLabel = () =>
        run('label', async () => {
            await updateAccount(account.id, { label: label.trim() || null });
        });

    const handleToggleDefault = () =>
        run('default', () =>
            updateAccount(account.id, { is_default_publishing: !account.is_default_publishing }),
        );

    const handleToggleDistribution = () =>
        run('distribution', () =>
            updateAccount(account.id, { enabled_for_distribution: !account.enabled_for_distribution }),
        );

    return (
        <div className="fixed inset-0 z-40">
            <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
            <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white border-l border-slate-200 shadow-xl flex flex-col">
                <header className="flex items-start gap-2 px-3 py-3 border-b border-slate-100">
                    <div className="w-10 h-10 rounded bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {account.profile_image_url ? (
                            <img src={account.profile_image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <span className={`inline-flex items-center justify-center w-full h-full ${meta.brand}`}>
                                <Icon className="w-5 h-5" />
                            </span>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-slate-900 truncate">
                            {account.display_name || account.username || meta.label}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                            {meta.label}
                            {account.username ? ` · @${account.username.replace(/^@/, '')}` : ''}
                        </div>
                        <div className="mt-1">
                            <StatusBadge status={account.status} />
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-slate-100 text-slate-500"
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

                    <section className="border border-slate-200 rounded">
                        <h4 className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 border-b border-slate-100 uppercase tracking-wide">
                            General
                        </h4>
                        <dl className="px-2.5 py-2 space-y-1.5">
                            <Row label="Account name" value={account.display_name ?? '—'} />
                            <Row label="Username" value={account.username ? `@${account.username.replace(/^@/, '')}` : '—'} />
                            <Row label="Account ID" value={account.account_id ?? '—'} mono />
                            <Row label="Account type" value={account.account_type ?? '—'} />
                            <Row label="Followers" value={fmtNum(account.followers)} />
                            <Row label="Connected" value={formatRelative(account.connected_at)} />
                        </dl>
                        <div className="px-2.5 pb-2.5">
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                Label
                            </label>
                            <div className="flex items-center gap-1.5">
                                <input
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                    disabled={!canManage}
                                    placeholder="e.g. Main brand channel"
                                    className="flex-1 bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40 disabled:bg-slate-100"
                                />
                                <button
                                    type="button"
                                    onClick={() => void handleSaveLabel()}
                                    disabled={!canManage || busy === 'label'}
                                    className="px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] text-slate-700 disabled:opacity-50"
                                >
                                    {busy === 'label' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="border border-slate-200 rounded">
                        <h4 className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 border-b border-slate-100 uppercase tracking-wide">
                            Authorization
                        </h4>
                        <div className="px-2.5 py-2 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-600">Connection</span>
                                <StatusBadge status={account.status} />
                            </div>
                            <Row label="Token expires" value={account.token_expires_at ? new Date(account.token_expires_at).toLocaleString() : '—'} />
                            <Row label="Last auth check" value={formatRelative(account.last_auth_check_at)} />

                            <div>
                                <div className="text-[11px] font-medium text-slate-600 mb-1">
                                    Permissions ({perm.granted} granted
                                    {perm.missing > 0 ? `, ${perm.missing} missing` : ''})
                                </div>
                                <ul className="space-y-1">
                                    {(account.scopes ?? []).map((s) => (
                                        <li key={s.key} className="flex items-center gap-1.5">
                                            {s.granted ? (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            ) : (
                                                <XCircle className="w-3.5 h-3.5 text-amber-600" />
                                            )}
                                            <span className="text-slate-700">{s.label}</span>
                                            {!s.granted && (
                                                <span className="text-[10px] text-amber-700">missing</span>
                                            )}
                                        </li>
                                    ))}
                                    {(account.missing_scopes ?? []).map((m) => (
                                        <li key={m} className="flex items-center gap-1.5">
                                            <XCircle className="w-3.5 h-3.5 text-amber-600" />
                                            <span className="text-slate-700">{m}</span>
                                        </li>
                                    ))}
                                    {!account.scopes?.length && !account.missing_scopes?.length && (
                                        <li className="text-slate-500">No scopes reported.</li>
                                    )}
                                </ul>
                            </div>

                            {(sm.warn || account.status === 'connected') && (
                                <button
                                    type="button"
                                    onClick={() => void handleReauthorize()}
                                    disabled={!canManage || busy === 'reauth'}
                                    className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 disabled:opacity-50"
                                >
                                    {busy === 'reauth' ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
                                    Reauthorize
                                </button>
                            )}
                        </div>
                    </section>

                    <section className="border border-slate-200 rounded">
                        <h4 className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 border-b border-slate-100 uppercase tracking-wide">
                            Synchronization
                        </h4>
                        <div className="px-2.5 py-2 space-y-1.5">
                            <Row label="Last successful sync" value={formatRelative(account.last_synced_at)} />
                            <Row
                                label="Last failed sync"
                                value={account.last_failed_sync_at ? formatRelative(account.last_failed_sync_at) : '—'}
                                valueClass={account.last_failed_sync_at ? 'text-rose-700' : undefined}
                            />
                            <Row label="Next scheduled sync" value={account.next_sync_at ? formatRelative(account.next_sync_at) : '—'} />
                            {account.error && (
                                <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1.5">
                                    {account.error}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => void handleSync()}
                                disabled={busy === 'sync' || !sm.canSync}
                                className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 disabled:opacity-50"
                            >
                                {busy === 'sync' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                Refresh now
                            </button>

                            {!!account.sync_history?.length && (
                                <div className="pt-1">
                                    <div className="text-[11px] font-medium text-slate-600 mb-1">Recent history</div>
                                    <ul className="space-y-1">
                                        {account.sync_history.slice(0, 5).map((h, i) => (
                                            <li key={`${h.at}-${i}`} className="flex items-start gap-1.5 text-[11px]">
                                                {h.status === 'success' ? (
                                                    <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-600 shrink-0" />
                                                ) : (
                                                    <XCircle className="w-3 h-3 mt-0.5 text-rose-600 shrink-0" />
                                                )}
                                                <span className="text-slate-600 min-w-0">
                                                    {formatRelative(h.at)}
                                                    {h.message ? ` · ${h.message}` : ''}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="border border-slate-200 rounded">
                        <h4 className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 border-b border-slate-100 uppercase tracking-wide">
                            Publishing
                        </h4>
                        <div className="px-2.5 py-2 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-600">Publishing capability</span>
                                <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${sm.canPublish ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {sm.canPublish ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                                    {sm.canPublish ? 'Available' : 'Unavailable'}
                                </span>
                            </div>

                            {!!account.publishing_formats?.length && (
                                <div>
                                    <div className="text-[11px] font-medium text-slate-600 mb-1">Supported formats</div>
                                    <div className="flex flex-wrap gap-1">
                                        {account.publishing_formats.map((f) => (
                                            <span key={f} className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-[10px] text-slate-600">
                                                {f}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!!account.publishing_restrictions?.length && (
                                <div>
                                    <div className="text-[11px] font-medium text-slate-600 mb-1">Restrictions</div>
                                    <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-0.5">
                                        {account.publishing_restrictions.map((r) => (
                                            <li key={r}>{r}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <label className="flex items-center gap-1.5 pt-1">
                                <input
                                    type="checkbox"
                                    checked={!!account.is_default_publishing}
                                    onChange={() => void handleToggleDefault()}
                                    disabled={!canManage || busy === 'default' || !sm.canPublish}
                                    className="accent-blue-950"
                                />
                                <span className="text-[11px] text-slate-700">Use as default publishing account</span>
                            </label>
                            <label className="flex items-center gap-1.5">
                                <input
                                    type="checkbox"
                                    checked={!!account.enabled_for_distribution}
                                    onChange={() => void handleToggleDistribution()}
                                    disabled={!canManage || busy === 'distribution'}
                                    className="accent-blue-950"
                                />
                                <span className="text-[11px] text-slate-700">Enabled for content distribution</span>
                            </label>
                        </div>
                    </section>

                    <section className="border border-slate-200 rounded">
                        <h4 className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 border-b border-slate-100 uppercase tracking-wide">
                            Access
                        </h4>
                        <div className="px-2.5 py-2 space-y-1.5">
                            {!!account.shares?.length ? (
                                <ul className="space-y-1">
                                    {account.shares.map((s) => (
                                        <li key={s.staff_id} className="flex items-center justify-between gap-2 text-[11px]">
                                            <span className="text-slate-700 truncate">{s.staff_name || s.staff_id}</span>
                                            <span className="text-slate-500">
                                                {s.permissions.join(', ')}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-[11px] text-slate-500">
                                    Only administrators can manage access. Staff sharing is configured in Staff Management.
                                </p>
                            )}
                            <Link
                                href="/staff"
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-950 hover:underline"
                            >
                                <Users className="w-3 h-3" />
                                Manage staff access
                            </Link>
                        </div>
                    </section>

                    <section className="border border-rose-200 rounded">
                        <h4 className="px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 border-b border-rose-100 uppercase tracking-wide">
                            Disconnect
                        </h4>
                        <div className="px-2.5 py-2 space-y-2">
                            <p className="text-[11px] text-slate-600">
                                Disconnecting revokes the stored tokens and removes the account from publishing. Existing published content is not deleted.
                            </p>
                            {!confirmDisconnect ? (
                                <button
                                    type="button"
                                    onClick={() => setConfirmDisconnect(true)}
                                    disabled={!canManage || busy === 'disconnect'}
                                    className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded border border-rose-300 bg-white hover:bg-rose-50 text-[11px] font-medium text-rose-700 disabled:opacity-50"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    Disconnect account
                                </button>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDisconnect(false)}
                                        disabled={busy === 'disconnect'}
                                        className="flex-1 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] text-slate-700"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleDisconnect()}
                                        disabled={busy === 'disconnect'}
                                        className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-medium disabled:opacity-50"
                                    >
                                        {busy === 'disconnect' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                        Confirm disconnect
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

function AccountsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [me, setMe] = useState<Me | null>(null);
    const [accounts, setAccounts] = useState<SocialAccount[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastLoadedAt, setLastLoadedAt] = useState<number>(Date.now());

    const [search, setSearch] = useState('');
    const [platformFilter, setPlatformFilter] = useState<PlatformKey | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<ConnectionStatus | 'all'>('all');

    const [connectOpen, setConnectOpen] = useState(false);
    const [connectInitialPlatform, setConnectInitialPlatform] = useState<PlatformKey | null>(null);
    const [openAccountId, setOpenAccountId] = useState<string | null>(null);
    const [syncingId, setSyncingId] = useState<string | null>(null);

    const load = useCallback(async (silent = false) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            const list = await fetchAccounts();
            setAccounts(list);
            setLastLoadedAt(Date.now());
        } catch (err: any) {
            if (err instanceof ApiError) setError(detailOf(err) ?? 'Could not load social accounts.');
            else if (err instanceof Error) setError(err.message);
            else setError('Could not load social accounts.');
            setAccounts(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
         ({ id: 'me' } as any) .then((u: any) => { if (!cancelled) setMe(u); }).catch(() => { if (!cancelled) setMe(null); });
        void load();
        return () => { cancelled = true; };
    }, [load]);

    useEffect(() => {
        const action = searchParams.get('action');
        const platform = searchParams.get('platform');
        const accountId = searchParams.get('account');
        const oauthError = searchParams.get('error');

        if (oauthError) {
            setError(`Authorization failed${platform ? ` for ${platform}` : ''}: ${oauthError}`);
        } else if (action === 'connect' || (platform && !accountId)) {
            const p = PLATFORM_ORDER.includes(platform as PlatformKey)
                ? (platform as PlatformKey)
                : null;
            setConnectInitialPlatform(p);
            setConnectOpen(true);
        }
        if (accountId) setOpenAccountId(accountId);
    }, [searchParams]);

    const canManage = useMemo(() => {
        const m = me as unknown as {
            permissions?: string[];
            role?: string;
            is_admin?: boolean;
            is_staff?: boolean;
            is_superuser?: boolean;
        } | null;
        if (!m) return false;
        if (m.is_superuser || m.is_admin || m.is_staff) return true;
        if (m.role === 'admin' || m.role === 'owner') return true;
        if (Array.isArray(m.permissions) && m.permissions.includes('manage_social_accounts')) return true;
        return false;
    }, [me]);

    const filtered = useMemo(() => {
        const list = accounts ?? [];
        const q = search.trim().toLowerCase();
        return list.filter((a) => {
            if (platformFilter !== 'all' && a.platform !== platformFilter) return false;
            if (statusFilter !== 'all' && a.status !== statusFilter) return false;
            if (!q) return true;
            const hay = `${a.display_name ?? ''} ${a.username ?? ''} ${a.label ?? ''} ${a.account_id ?? ''}`.toLowerCase();
            return hay.includes(q);
        });
    }, [accounts, platformFilter, statusFilter, search]);

    const openAccount = useMemo(
        () => (accounts ?? []).find((a) => a.id === openAccountId) ?? null,
        [accounts, openAccountId],
    );

    const closeConnect = () => {
        setConnectOpen(false);
        setConnectInitialPlatform(null);
        router.replace('/social/accounts');
    };

    const closeDrawer = () => {
        setOpenAccountId(null);
        router.replace('/social/accounts');
    };

    const handleSync = async (id: string) => {
        setSyncingId(id);
        setError(null);
        try {
            await syncAccount(id);
            await load(true);
        } catch (err: any) {
            if (err instanceof ApiError) setError(detailOf(err) ?? 'Could not sync account.');
            else if (err instanceof Error) setError(err.message);
            else setError('Could not sync account.');
        } finally {
            setSyncingId(null);
        }
    };

    const connectedCount = (accounts ?? []).filter((a) => a.status === 'connected').length;
    const attentionCount = (accounts ?? []).filter((a) =>
        ['authorization_expired', 'permission_required', 'sync_failed', 'temporarily_unavailable'].includes(a.status),
    ).length;

    return (
        <div className="space-y-3">
            <header className="bg-white border border-slate-200 rounded p-3 sm:p-4 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-[18px] font-semibold text-slate-900">Accounts &amp; Channels</h1>
                        <p className="text-[12px] sm:text-[13px] text-slate-500">
                            Connect and manage the social accounts used by your business. All
                            authorization is handled through each platform&apos;s official OAuth flow.
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            onClick={() => {
                                setConnectInitialPlatform(null);
                                setConnectOpen(true);
                            }}
                            disabled={!canManage}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-blue-950 hover:bg-blue-900 text-white text-[12px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!canManage ? 'Administrator permission required' : 'Connect a new social account'}
                        >
                            <UserPlus className="w-3.5 h-3.5" />
                            Connect account
                        </button>
                        <button
                            type="button"
                            onClick={() => void load(true)}
                            disabled={refreshing}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[12px] text-slate-700 disabled:opacity-50"
                        >
                            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Last sync summary:
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="w-3 h-3" />
                        {connectedCount} connected
                    </span>
                    {attentionCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                            <AlertTriangle className="w-3 h-3" />
                            {attentionCount} need attention
                        </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-slate-400">
                        UI updated {formatRelative(new Date(lastLoadedAt).toISOString())}
                    </span>
                </div>

                {!canManage && (
                    <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-[12px] text-amber-800 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        You have view-only access to this page. Ask an administrator to connect,
                        reauthorize or disconnect accounts.
                    </div>
                )}

                {error && (
                    <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2 text-[12px] text-rose-700 flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">{error}</span>
                        <button
                            type="button"
                            onClick={() => void load()}
                            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border border-rose-300 bg-white hover:bg-rose-50 text-[11px] font-medium text-rose-700"
                        >
                            <RefreshCw className="w-3 h-3" /> Retry
                        </button>
                    </div>
                )}
            </header>

            <div className="bg-white border border-slate-200 rounded p-2.5 flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, handle, label or account ID"
                        className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                    />
                </div>
                <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <select
                        value={platformFilter}
                        onChange={(e) => setPlatformFilter(e.target.value as PlatformKey | 'all')}
                        className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-700"
                    >
                        <option value="all">All platforms</option>
                        <option value="youtube">YouTube</option>
                        <option value="facebook">Facebook</option>
                        <option value="instagram">Instagram</option>
                        <option value="tiktok">TikTok</option>
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as ConnectionStatus | 'all')}
                        className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-700"
                    >
                        {STATUS_FILTERS.map((s) => (
                            <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white border border-slate-200 rounded p-3 animate-pulse space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded bg-slate-100" />
                                <div className="flex-1 space-y-1">
                                    <div className="h-3 w-32 bg-slate-100 rounded" />
                                    <div className="h-2.5 w-24 bg-slate-100 rounded" />
                                </div>
                            </div>
                            <div className="h-12 bg-slate-50 rounded" />
                            <div className="h-6 bg-slate-100 rounded" />
                        </div>
                    ))}
                </div>
            ) : !accounts ? null : accounts.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded p-6 text-center">
                    <div className="w-12 h-12 mx-auto rounded-full bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center">
                        <UserPlus className="w-5 h-5" />
                    </div>
                    <h3 className="mt-2 text-[13px] font-semibold text-slate-900">No accounts connected yet</h3>
                    <p className="text-[12px] text-slate-500 mt-1 max-w-md mx-auto">
                        Connect YouTube, Facebook, Instagram or TikTok to publish content and
                        track performance from one place.
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            setConnectInitialPlatform(null);
                            setConnectOpen(true);
                        }}
                        disabled={!canManage}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-950 hover:bg-blue-900 text-white text-[12px] font-medium disabled:opacity-50"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Connect your first account
                    </button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded p-6 text-center text-[12px] text-slate-500">
                    No accounts match these filters.
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {filtered.map((a) => (
                        <AccountCard
                            key={a.id}
                            account={a}
                            onOpen={() => setOpenAccountId(a.id)}
                            onSync={() => void handleSync(a.id)}
                            busy={syncingId === a.id}
                        />
                    ))}
                </div>
            )}

            <ConnectModal
                open={connectOpen}
                initialPlatform={connectInitialPlatform}
                onClose={closeConnect}
                onStarted={() => { }}
                canManage={canManage}
            />

            <AccountDrawer
                account={openAccount}
                onClose={closeDrawer}
                onChanged={() => void load(true)}
                canManage={canManage}
            />
        </div>
    );
}

export default function SocialAccountsPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-[300px] flex items-center justify-center p-6">
                    <div className="flex items-center gap-2 text-slate-500 text-[13px]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading accounts…
                    </div>
                </div>
            }
        >
            <AccountsPageContent />
        </Suspense>
    );
}