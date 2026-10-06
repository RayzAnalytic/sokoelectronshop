'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Share2,
  Plus,
  CheckCircle2,
  X,
  Trash2,
  Image as ImageIcon,
  Send,
  Eye,
  TrendingUp,
  ThumbsUp,
  Clock,
  ShoppingBag,
  AlertCircle,
  Sparkles,
  MessageSquare,
  ArrowRight,
  BarChart3,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  FaFacebookF,
  FaInstagram,
  FaTiktok,
  FaYoutube,
  FaXTwitter,
} from 'react-icons/fa6';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

import { adminApi } from '@/lib/admin-api';
import type {
  AdminSocialAccount,
  AdminSocialEngagementPoint,
  AdminSocialFollowerPoint,
  AdminSocialPlatform,
} from '@/lib/admin-types';

// --- TYPES ---
type SocialTab = 'Scheduled' | 'Published' | 'Analytics';
type SocialPlatform = AdminSocialPlatform;
type MediaType = 'image' | 'video';

interface ConnectedAccount {
  id: SocialPlatform;
  name: string;
  handle: string;
  connected: boolean;
  avatarBg: string;
}

interface MediaItem {
  /** Local React key. */
  id: string;
  /** Backend id returned by `media.upload()`. Undefined while uploading. */
  serverId?: number;
  url: string;
  type: MediaType;
  name: string;
  size: number;
  uploading?: boolean;
  progress?: number;
  error?: string;
}

interface ScheduledPost {
  id: string;
  platforms: SocialPlatform[];
  caption: string;
  scheduledTime: string;
  mediaUrl?: string;
  productTag?: string;
}

interface PublishedPost {
  id: string;
  platform: SocialPlatform;
  caption: string;
  publishedAt: string;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
}

const AVAILABLE_PRODUCTS = [
  'SokoFlow Pro Subscription',
  'Smart Home Wi-Fi Router AX3000',
  'Wireless Ergonomic Mechanical Keyboard',
  'UltraWide 29" Gaming Monitor',
  'USB-C Multiport Hub 7-in-1',
];

const PLATFORMS: SocialPlatform[] = ['Facebook', 'Instagram', 'TikTok', 'YouTube', 'X'];
const TABS: SocialTab[] = ['Scheduled', 'Published', 'Analytics'];

const MAX_MEDIA_FILES = 5;
const MAX_FILE_SIZE_MB = 25;

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** ISO8601 → "Just now" / "2 days ago" / "12 Oct" */
const relativeTime = (iso: string | null): string => {
  if (!iso) return 'Publishing…';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day} days ago`;
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
};

/** ISO8601 → "Tomorrow, 10:00 AM" / "26 Sep, 2:30 PM" */
const formatScheduledTime = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const timeStr = d.toLocaleTimeString('en-KE', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (d.toDateString() === now.toDateString()) return `Today, ${timeStr}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${timeStr}`;
  const dateStr = d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  return `${dateStr}, ${timeStr}`;
};

const PlatformIcon = ({ platform, className = 'w-3.5 h-3.5' }: { platform: SocialPlatform; className?: string }) => {
  switch (platform) {
    case 'Facebook':
      return <FaFacebookF className={className} />;
    case 'Instagram':
      return <FaInstagram className={className} />;
    case 'TikTok':
      return <FaTiktok className={className} />;
    case 'YouTube':
      return <FaYoutube className={className} />;
    case 'X':
      return <FaXTwitter className={className} />;
  }
};

export default function SocialMediaPage() {
  const [activeTab, setActiveTab] = useState<SocialTab>('Scheduled');

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [publishedPosts, setPublishedPosts] = useState<PublishedPost[]>([]);
  const [followerData, setFollowerData] = useState<AdminSocialFollowerPoint[]>([]);
  const [engagementData, setEngagementData] = useState<AdminSocialEngagementPoint[]>([]);

  const [accountsLoading, setAccountsLoading] = useState(true);
  const [scheduledLoading, setScheduledLoading] = useState(true);
  const [publishedLoading, setPublishedLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<ConnectedAccount | null>(null);
  const [disconnectInFlight, setDisconnectInFlight] = useState(false);
  const [connectInFlight, setConnectInFlight] = useState<SocialPlatform | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [composerCaption, setComposerCaption] = useState('');
  const [composerPlatforms, setComposerPlatforms] = useState<SocialPlatform[]>([]);
  const [composerProductTag, setComposerProductTag] = useState('');
  const [composerScheduleTime, setComposerScheduleTime] = useState('');
  const [composerMedia, setComposerMedia] = useState<MediaItem[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [composerSubmitting, setComposerSubmitting] = useState(false);

  const toast = useCallback((msg: string) => setToastMessage(msg), []);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3200);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const anyModalOpen = !!disconnectTarget || composerOpen;

  useEffect(() => {
    if (!anyModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (disconnectTarget) setDisconnectTarget(null);
        else if (composerOpen) closeComposer();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyModalOpen, disconnectTarget, composerOpen]);

  // ── Data loaders ────────────────────────────────────────────────────────

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const res = await adminApi.social.accounts.list();
      setAccounts(res.map((a) => ({
        id: a.id,
        name: a.name,
        handle: a.handle,
        connected: a.connected,
        avatarBg: a.avatarBg,
      })));
    } catch (e: any) {
      toast(e?.message ?? 'Could not load accounts.');
    } finally {
      setAccountsLoading(false);
    }
  }, [toast]);

  const loadScheduled = useCallback(async () => {
    setScheduledLoading(true);
    try {
      const res = await adminApi.social.posts.listScheduled();
      setScheduledPosts(res.map((p) => ({
        id: String(p.id),
        platforms: p.platforms,
        caption: p.caption,
        scheduledTime: formatScheduledTime(p.scheduledTime),
        mediaUrl: p.mediaUrl ?? undefined,
        productTag: p.productTag ?? undefined,
      })));
    } catch (e: any) {
      toast(e?.message ?? 'Could not load scheduled posts.');
    } finally {
      setScheduledLoading(false);
    }
  }, [toast]);

  const loadPublished = useCallback(async () => {
    setPublishedLoading(true);
    try {
      const res = await adminApi.social.posts.listPublished();
      setPublishedPosts(res.map((p) => ({
        id: String(p.id),
        platform: p.platform,
        caption: p.caption,
        publishedAt: relativeTime(p.publishedAt),
        likes: p.likes,
        comments: p.comments,
        shares: p.shares,
        reach: p.reach,
      })));
    } catch (e: any) {
      toast(e?.message ?? 'Could not load published posts.');
    } finally {
      setPublishedLoading(false);
    }
  }, [toast]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const [followers, engagement] = await Promise.all([
        adminApi.social.analytics.followers(5),
        adminApi.social.analytics.engagement(),
      ]);
      setFollowerData(followers);
      setEngagementData(engagement);
      setAnalyticsLoaded(true);
    } catch (e: any) {
      toast(e?.message ?? 'Could not load analytics.');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadAccounts();
    void loadScheduled();
    void loadPublished();
  }, [loadAccounts, loadScheduled, loadPublished]);

  // Lazy-load analytics on first visit to that tab
  useEffect(() => {
    if (activeTab === 'Analytics' && !analyticsLoaded && !analyticsLoading) {
      void loadAnalytics();
    }
  }, [activeTab, analyticsLoaded, analyticsLoading, loadAnalytics]);

  // ── Composer lifecycle ──────────────────────────────────────────────────

  const openComposer = () => {
    setComposerCaption('');
    setComposerPlatforms(accounts.filter((a) => a.connected).map((a) => a.id).slice(0, 2));
    setComposerProductTag('');
    setComposerScheduleTime('');
    setIsScheduling(false);
    setComposerSubmitting(false);
    composerMedia.forEach((m) => URL.revokeObjectURL(m.url));
    setComposerMedia([]);
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    composerMedia.forEach((m) => URL.revokeObjectURL(m.url));
    setComposerMedia([]);
    setComposerCaption('');
    setComposerProductTag('');
    setComposerScheduleTime('');
    setIsScheduling(false);
    setComposerSubmitting(false);
  };

  // ── Connect / disconnect ────────────────────────────────────────────────

  const togglePlatformConnect = async (account: ConnectedAccount) => {
    if (account.connected) {
      setDisconnectTarget(account);
      return;
    }

    setConnectInFlight(account.id);
    try {
      const res = await adminApi.social.accounts.connect(account.id);

      // Live OAuth: backend tells us where to redirect
      if ('authUrl' in res) {
        window.location.href = res.authUrl;
        return;
      }

      // Dry-run: backend already flipped the flag
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === account.id
            ? { ...a, connected: res.connected, handle: res.handle || a.handle }
            : a,
        ),
      );
      toast(`Connected to ${account.name}`);
    } catch (e: any) {
      toast(e?.message ?? 'Could not connect.');
    } finally {
      setConnectInFlight(null);
    }
  };

  const confirmDisconnect = async () => {
    if (!disconnectTarget || disconnectInFlight) return;
    setDisconnectInFlight(true);
    try {
      const res = await adminApi.social.accounts.disconnect(disconnectTarget.id);
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === disconnectTarget.id
            ? { ...a, connected: res.connected, handle: res.handle || '' }
            : a,
        ),
      );
      setComposerPlatforms((prev) => prev.filter((p) => p !== disconnectTarget.id));
      toast(`Disconnected from ${disconnectTarget.name}`);
      setDisconnectTarget(null);
    } catch (e: any) {
      toast(e?.message ?? 'Disconnect failed.');
    } finally {
      setDisconnectInFlight(false);
    }
  };

  // ── Publish / schedule ──────────────────────────────────────────────────

  const publishOrSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (composerSubmitting) return;
    if (!composerCaption.trim() || composerPlatforms.length === 0) return;

    // Guard: media uploads must be finished and free of errors before submit
    const stillUploading = composerMedia.some((m) => m.uploading);
    if (stillUploading) {
      toast('Wait for uploads to finish.');
      return;
    }
    const uploadErrors = composerMedia.filter((m) => m.error);
    if (uploadErrors.length > 0) {
      toast('Remove failed uploads before posting.');
      return;
    }

    let scheduleAt: string | null = null;
    if (isScheduling) {
      if (!composerScheduleTime.trim()) {
        toast('Pick a time for the scheduled post');
        return;
      }
      const dt = new Date(composerScheduleTime);
      if (Number.isNaN(dt.getTime()) || dt <= new Date()) {
        toast('Scheduled time must be in the future.');
        return;
      }
      scheduleAt = dt.toISOString();
    }

    setComposerSubmitting(true);
    try {
      const mediaIds = composerMedia
        .filter((m) => m.serverId !== undefined)
        .map((m) => m.serverId as number);

      await adminApi.social.posts.create({
        caption: composerCaption,
        platforms: composerPlatforms,
        ...(composerProductTag ? { productTag: composerProductTag } : {}),
        ...(mediaIds.length > 0 ? { mediaIds } : {}),
        ...(scheduleAt ? { scheduleAt } : {}),
      });

      if (scheduleAt) {
        toast('Post scheduled');
        setActiveTab('Scheduled');
        await loadScheduled();
      } else {
        toast(`Publishing to ${composerPlatforms.join(', ')}…`);
        setActiveTab('Published');
        // The backend fans out asynchronously; poll a couple of times
        // to catch the row appearing in the published list.
        await loadPublished();
        setTimeout(() => void loadPublished(), 2000);
        setTimeout(() => void loadPublished(), 5000);
      }

      closeComposer();
    } catch (e: any) {
      toast(e?.message ?? 'Could not submit the post.');
    } finally {
      setComposerSubmitting(false);
    }
  };

  const deleteScheduled = async (id: string) => {
    // Optimistic removal
    const prev = scheduledPosts;
    setScheduledPosts((p) => p.filter((x) => x.id !== id));
    try {
      await adminApi.social.posts.remove(id);
      toast('Scheduled post deleted');
    } catch (e: any) {
      setScheduledPosts(prev);
      toast(e?.message ?? 'Could not delete.');
    }
  };

  const postNowFromScheduled = async (post: ScheduledPost) => {
    const prev = scheduledPosts;
    setScheduledPosts((p) => p.filter((x) => x.id !== post.id));
    try {
      await adminApi.social.posts.publishNow(post.id);
      toast('Publishing…');
      setActiveTab('Published');
      await loadPublished();
      setTimeout(() => void loadPublished(), 2000);
      setTimeout(() => void loadPublished(), 5000);
    } catch (e: any) {
      setScheduledPosts(prev);
      toast(e?.message ?? 'Could not publish.');
    }
  };

  const platformBadge = (p: SocialPlatform) =>
    p === 'Facebook'
      ? 'bg-blue-50 text-[#1877F2] border-blue-100'
      : p === 'Instagram'
        ? 'bg-pink-50 text-pink-700 border-pink-100'
        : p === 'TikTok'
          ? 'bg-slate-100 text-slate-800 border-slate-200'
          : p === 'YouTube'
            ? 'bg-red-50 text-[#FF0000] border-red-100'
            : 'bg-slate-100 text-slate-800 border-slate-200';

  const connectedAccounts = accounts.filter((a) => a.connected);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[120] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Social media</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Central social management hub — connect, create, publish, and analyze
            </p>
          </div>
          <button
            onClick={openComposer}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create post</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* CONTENT STUDIO FLOW */}
        <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 space-y-2">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
            <div className="text-[13px]">
              <p className="font-medium text-blue-950">Content Studio</p>
              <p className="text-blue-800 mt-0.5">
                Click <span className="font-medium">Create post</span> to open the studio: upload media, write a caption, select channels, then publish or schedule.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {[
              { step: 1, label: 'Media', icon: ImageIcon },
              { step: 2, label: 'Caption', icon: MessageSquare },
              { step: 3, label: 'Channels', icon: Share2 },
              { step: 4, label: 'Publish', icon: Send },
              { step: 5, label: 'Track', icon: BarChart3 },
            ].map((s, i, arr) => {
              const Icon = s.icon;
              return (
                <React.Fragment key={s.step}>
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[13px] font-medium whitespace-nowrap border bg-white text-slate-600 border-slate-200">
                    <Icon className="w-3 h-3" />
                    {s.step}. {s.label}
                  </div>
                  {i < arr.length - 1 && (
                    <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* CONNECTED ACCOUNTS */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-slate-900 inline-flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-blue-950" />
              Connected accounts
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-slate-500">
                {connectedAccounts.length} of {accounts.length} connected
              </span>
              <button
                onClick={() => void loadAccounts()}
                disabled={accountsLoading}
                aria-label="Refresh accounts"
                className="p-1 rounded-sm hover:bg-slate-100 text-slate-500 disabled:opacity-40"
              >
                {accountsLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {accountsLoading && accounts.length === 0 ? (
            <div className="py-12 flex items-center justify-center text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-[13px]">Loading accounts…</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {accounts.map((acc) => {
                const isConnecting = connectInFlight === acc.id;
                return (
                  <div
                    key={acc.id}
                    className={`bg-white border rounded-sm p-2 flex items-center justify-between gap-2 ${acc.connected
                        ? 'border-emerald-200 ring-1 ring-emerald-100'
                        : 'border-slate-200'
                      }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-9 h-9 rounded-sm ${acc.avatarBg} text-white font-semibold text-[13px] flex items-center justify-center shrink-0`}
                      >
                        <PlatformIcon platform={acc.id} className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-900 truncate">
                          {acc.name}
                        </p>
                        <p className="text-[13px] text-slate-500 font-mono truncate">
                          {acc.handle || '—'}
                        </p>
                        <span
                          className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-sm text-[13px] font-medium border ${acc.connected
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                        >
                          {acc.connected ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => void togglePlatformConnect(acc)}
                      disabled={isConnecting}
                      className={`px-2.5 py-2 rounded-sm font-medium text-[13px] transition shrink-0 border disabled:opacity-50 ${acc.connected
                          ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          : 'bg-blue-950 border-blue-950 text-white hover:bg-blue-900'
                        }`}
                    >
                      {isConnecting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : acc.connected ? (
                        'Disconnect'
                      ) : (
                        'Connect'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* TABS */}
        <div className="bg-white border border-slate-200 rounded-sm p-0.5 inline-flex gap-0.5 overflow-x-auto max-w-full">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${activeTab === tab ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* TAB 1: SCHEDULED */}
        {activeTab === 'Scheduled' && (
          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <p className="text-[13px] font-medium text-slate-700">
                Upcoming scheduled posts · {scheduledPosts.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void loadScheduled()}
                  disabled={scheduledLoading}
                  aria-label="Refresh scheduled posts"
                  className="p-1 rounded-sm hover:bg-slate-100 text-slate-500 disabled:opacity-40"
                >
                  {scheduledLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={openComposer}
                  className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  New post
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2 px-3 font-medium">Platforms</th>
                    <th className="py-2 px-3 font-medium">Caption</th>
                    <th className="py-2 px-3 font-medium">Product tag</th>
                    <th className="py-2 px-3 font-medium">Scheduled</th>
                    <th className="py-2 px-3 w-40"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scheduledLoading && scheduledPosts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 text-[13px]">
                        <div className="inline-flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading scheduled posts…
                        </div>
                      </td>
                    </tr>
                  ) : scheduledPosts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 text-[13px]">
                        No scheduled posts yet. Click{' '}
                        <span className="font-medium text-slate-600">Create post</span> to add one.
                      </td>
                    </tr>
                  ) : (
                    scheduledPosts.map((post) => (
                      <tr key={post.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1">
                            {post.platforms.map((p) => (
                              <span
                                key={p}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border text-[13px] ${platformBadge(p)}`}
                              >
                                <PlatformIcon platform={p} className="w-3 h-3" />
                                {p}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-slate-600 truncate max-w-sm">
                          {post.caption}
                        </td>
                        <td className="py-2 px-3 text-slate-500">{post.productTag || '—'}</td>
                        <td className="py-2 px-3 text-blue-950 font-medium">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {post.scheduledTime}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => void postNowFromScheduled(post)}
                              className="px-2.5 py-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-[13px]"
                            >
                              Post now
                            </button>
                            <button
                              onClick={() => void deleteScheduled(post.id)}
                              aria-label="Delete scheduled post"
                              className="p-2 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: PUBLISHED */}
        {activeTab === 'Published' && (
          <div className="space-y-3">
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
              <p className="text-[13px] font-semibold text-slate-900 inline-flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-blue-950" />
                Platform engagement comparison
              </p>
              <div className="h-56 w-full">
                {analyticsLoading && engagementData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span className="text-[13px]">Loading chart…</span>
                  </div>
                ) : engagementData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-[13px]">
                    No engagement data yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={engagementData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="platform" stroke="#94a3b8" fontSize={13} />
                      <YAxis stroke="#94a3b8" fontSize={13} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '2px',
                          color: '#0f172a',
                          fontSize: '13px',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="Reach" fill="#172554" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Engagement" fill="#10b981" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <p className="text-[13px] font-medium text-slate-700">
                  Published posts &amp; analytics · {publishedPosts.length}
                </p>
                <button
                  onClick={() => void loadPublished()}
                  disabled={publishedLoading}
                  aria-label="Refresh published posts"
                  className="p-1 rounded-sm hover:bg-slate-100 text-slate-500 disabled:opacity-40"
                >
                  {publishedLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-3 font-medium">Platform</th>
                      <th className="py-2 px-3 font-medium">Caption</th>
                      <th className="py-2 px-3 font-medium">Published</th>
                      <th className="py-2 px-3 font-medium text-center">Likes</th>
                      <th className="py-2 px-3 font-medium text-center">Comments</th>
                      <th className="py-2 px-3 font-medium text-center">Shares</th>
                      <th className="py-2 px-3 font-medium text-right">Reach</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {publishedLoading && publishedPosts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 text-[13px]">
                          <div className="inline-flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading published posts…
                          </div>
                        </td>
                      </tr>
                    ) : publishedPosts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 text-[13px]">
                          No published posts yet. Posts you publish from the composer will appear here.
                        </td>
                      </tr>
                    ) : (
                      publishedPosts.map((pub) => (
                        <tr key={pub.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border text-[13px] ${platformBadge(pub.platform)}`}
                            >
                              <PlatformIcon platform={pub.platform} className="w-3 h-3" />
                              {pub.platform}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-700 truncate max-w-xs">
                            {pub.caption}
                          </td>
                          <td className="py-2 px-3 text-slate-400">{pub.publishedAt}</td>
                          <td className="py-2 px-3 text-center font-medium text-slate-900">
                            {pub.likes}
                          </td>
                          <td className="py-2 px-3 text-center text-slate-700">{pub.comments}</td>
                          <td className="py-2 px-3 text-center text-slate-700">{pub.shares}</td>
                          <td className="py-2 px-3 text-right font-mono text-blue-950">
                            {pub.reach.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ANALYTICS */}
        {activeTab === 'Analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
              <p className="text-[13px] font-semibold text-slate-900 inline-flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-950" />
                Follower growth over time
              </p>
              <div className="h-64 w-full">
                {analyticsLoading && followerData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span className="text-[13px]">Loading chart…</span>
                  </div>
                ) : followerData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-[13px]">
                    No follower snapshots yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={followerData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={13} />
                      <YAxis stroke="#94a3b8" fontSize={13} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '2px',
                          color: '#0f172a',
                          fontSize: '13px',
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="Instagram" stroke="#db2777" strokeWidth={2} />
                      <Line type="monotone" dataKey="TikTok" stroke="#0f172a" strokeWidth={2} />
                      <Line type="monotone" dataKey="Facebook" stroke="#1877F2" strokeWidth={2} />
                      <Line type="monotone" dataKey="YouTube" stroke="#dc2626" strokeWidth={2} />
                      <Line type="monotone" dataKey="X" stroke="#0ea5e9" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
              <p className="text-[13px] font-semibold text-slate-900 inline-flex items-center gap-1.5">
                <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                Engagement by platform
              </p>
              <div className="h-64 w-full">
                {analyticsLoading && engagementData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span className="text-[13px]">Loading chart…</span>
                  </div>
                ) : engagementData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-[13px]">
                    No engagement data yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={engagementData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="platform" stroke="#94a3b8" fontSize={13} />
                      <YAxis stroke="#94a3b8" fontSize={13} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '2px',
                          color: '#0f172a',
                          fontSize: '13px',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="Engagement" fill="#10b981" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ══════════════════════════════════════════ */}
      {/* CREATE POST MODAL                          */}
      {/* ══════════════════════════════════════════ */}
      {composerOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={closeComposer}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-5xl w-full max-h-[92vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-9 h-9 rounded-sm bg-blue-50 text-blue-950 border border-blue-100 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-slate-900 truncate">
                    Create post
                  </h3>
                  <p className="text-[13px] text-slate-500 truncate">
                    Upload media, write a caption, pick channels, then publish or schedule
                  </p>
                </div>
              </div>
              <button
                onClick={closeComposer}
                aria-label="Close composer"
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 lg:grid-cols-2 gap-3">

              {/* LEFT: Form */}
              <div className="space-y-3 text-[13px]">
                <form id="composer-form" onSubmit={publishOrSchedule} className="space-y-3">

                  {/* Media */}
                  <div>
                    <label className="block font-medium text-slate-700 mb-1 inline-flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      Media (images &amp; videos)
                    </label>
                    <MediaUploader media={composerMedia} setMedia={setComposerMedia} onToast={toast} />
                  </div>

                  {/* Caption */}
                  <div>
                    <label className="block font-medium text-slate-700 mb-1 inline-flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      Caption
                    </label>
                    <textarea
                      rows={5}
                      required
                      placeholder="Write engaging caption with hashtags…"
                      value={composerCaption}
                      onChange={(e) => setComposerCaption(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                    />
                    <p className="text-[13px] text-slate-400 mt-1">
                      {composerCaption.length} characters
                    </p>
                  </div>

                  {/* Channels */}
                  <div>
                    <label className="block font-medium text-slate-700 mb-1 inline-flex items-center gap-1">
                      <Share2 className="w-3 h-3" />
                      Channels
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {PLATFORMS.map((plat) => {
                        const isSelected = composerPlatforms.includes(plat);
                        const account = accounts.find((a) => a.id === plat);
                        const isConnected = account?.connected;
                        return (
                          <button
                            key={plat}
                            type="button"
                            disabled={!isConnected}
                            onClick={() =>
                              setComposerPlatforms((prev) =>
                                isSelected ? prev.filter((p) => p !== plat) : [...prev, plat]
                              )
                            }
                            className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-sm font-medium text-[13px] transition border ${isSelected
                                ? 'bg-blue-950 text-white border-blue-950'
                                : !isConnected
                                  ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                            title={!isConnected ? `${plat} not connected` : undefined}
                          >
                            <PlatformIcon platform={plat} className="w-3.5 h-3.5" />
                            {plat}
                            {!isConnected && <span className="text-[13px]">· off</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Product tag */}
                  <div>
                    <label className="block font-medium text-slate-700 mb-1 inline-flex items-center gap-1">
                      <ShoppingBag className="w-3 h-3" />
                      Product tag (optional)
                    </label>
                    <select
                      value={composerProductTag}
                      onChange={(e) => setComposerProductTag(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                    >
                      <option value="">No product tag</option>
                      {AVAILABLE_PRODUCTS.map((prod) => (
                        <option key={prod} value={prod}>
                          {prod}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Publish / Schedule */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <p className="text-[13px] font-medium text-slate-700 inline-flex items-center gap-1">
                      <Send className="w-3 h-3" />
                      Publish or schedule
                    </p>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="font-medium text-slate-700">Schedule for later</span>
                      <input
                        type="checkbox"
                        checked={isScheduling}
                        onChange={(e) => setIsScheduling(e.target.checked)}
                        className="h-4 w-4 rounded-sm border-slate-300 text-blue-950 focus:ring-blue-950"
                      />
                    </label>

                    {isScheduling && (
                      <input
                        type="datetime-local"
                        value={composerScheduleTime}
                        min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                        onChange={(e) => setComposerScheduleTime(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                      />
                    )}
                  </div>
                </form>
              </div>

              {/* RIGHT: Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-slate-900 inline-flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-blue-950" />
                    Live preview
                  </p>
                  <span className="text-[13px] bg-blue-50 text-blue-950 border border-blue-100 font-medium px-2 py-0.5 rounded-sm">
                    {composerPlatforms.length} channel{composerPlatforms.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {composerPlatforms.length === 0 ? (
                  <div className="py-16 text-center text-[13px] text-slate-400 border border-dashed border-slate-300 rounded-sm">
                    Select at least one connected platform to view preview.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                    {composerPlatforms.map((plat) => (
                      <div
                        key={plat}
                        className="border border-slate-200 rounded-sm p-2 space-y-2 bg-slate-50"
                      >
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="font-medium text-slate-800 inline-flex items-center gap-1.5">
                            <PlatformIcon platform={plat} className="w-3.5 h-3.5 text-blue-950" />
                            {plat} preview
                          </span>
                          <span className="text-slate-400">
                            {plat === 'YouTube' ? 'Video' : 'Feed'}
                          </span>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-blue-950 text-white font-medium flex items-center justify-center text-[13px]">
                              SF
                            </span>
                            <div>
                              <p className="text-[13px] font-medium text-slate-900">
                                SokoFlow Official
                              </p>
                              <p className="text-[13px] text-slate-400">Just now</p>
                            </div>
                          </div>

                          <p className="text-[13px] text-slate-800 whitespace-pre-wrap">
                            {composerCaption || 'Your caption will appear here as you type…'}
                          </p>

                          {composerMedia.length > 0 && (
                            <div className="grid grid-cols-2 gap-1 rounded-sm overflow-hidden border border-slate-200">
                              {composerMedia.slice(0, 4).map((m) =>
                                m.type === 'video' ? (
                                  <video
                                    key={m.id}
                                    src={m.url}
                                    muted
                                    playsInline
                                    className="w-full aspect-square object-cover"
                                  />
                                ) : (
                                  <img
                                    key={m.id}
                                    src={m.url}
                                    alt=""
                                    className="w-full aspect-square object-cover"
                                  />
                                )
                              )}
                              {composerMedia.length > 4 && (
                                <div className="relative aspect-square bg-slate-900/70 text-white flex items-center justify-center text-[13px] font-medium">
                                  +{composerMedia.length - 4} more
                                </div>
                              )}
                            </div>
                          )}

                          {composerProductTag && (
                            <div className="bg-blue-50 border border-blue-100 rounded-sm p-2 flex items-center gap-2 text-[13px] text-blue-950 font-medium">
                              <ShoppingBag className="w-3.5 h-3.5 text-blue-950" />
                              Shop: {composerProductTag}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <p className="text-[13px] text-slate-500 truncate">
                {composerMedia.length > 0
                  ? `${composerMedia.length} media file(s) attached`
                  : 'No media attached'}
                {composerPlatforms.length > 0
                  ? ` · ${composerPlatforms.length} channel(s)`
                  : ''}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeComposer}
                  disabled={composerSubmitting}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="composer-form"
                  disabled={
                    composerSubmitting ||
                    !composerCaption.trim() ||
                    composerPlatforms.length === 0 ||
                    composerMedia.some((m) => m.uploading || m.error)
                  }
                  className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
                >
                  {composerSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  {composerSubmitting
                    ? 'Submitting…'
                    : isScheduling
                      ? 'Schedule post'
                      : 'Publish now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DISCONNECT CONFIRM */}
      {disconnectTarget && (
        <div
          className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => !disconnectInFlight && setDisconnectTarget(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl text-center space-y-3 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-sm bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">
                Disconnect {disconnectTarget.name}?
              </h3>
              <p className="text-slate-500 mt-1">
                Scheduled posts to{' '}
                <span className="font-mono text-slate-800">{disconnectTarget.handle}</span> will fail
                until reconnected.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => setDisconnectTarget(null)}
                disabled={disconnectInFlight}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDisconnect()}
                disabled={disconnectInFlight}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-sm text-[13px] disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {disconnectInFlight && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   Media uploader — uploads to the backend
   on add, tracks progress, exposes server id
   ══════════════════════════════════════════ */
function MediaUploader({
  media,
  setMedia,
  onToast,
}: {
  media: MediaItem[];
  setMedia: React.Dispatch<React.SetStateAction<MediaItem[]>>;
  onToast: (msg: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;

    const remainingSlots = MAX_MEDIA_FILES - media.length;
    if (remainingSlots <= 0) {
      onToast(`Max ${MAX_MEDIA_FILES} files per post`);
      return;
    }

    const incoming = Array.from(files).slice(0, remainingSlots);
    const accepted: Array<{ item: MediaItem; file: File }> = [];
    let rejected = 0;

    incoming.forEach((file) => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) {
        rejected++;
        return;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        rejected++;
        return;
      }

      const id = `media-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const url = URL.createObjectURL(file);

      accepted.push({
        item: {
          id,
          url,
          type: isVideo ? 'video' : 'image',
          name: file.name,
          size: file.size,
          uploading: true,
          progress: 0,
        },
        file,
      });
    });

    if (accepted.length === 0) {
      if (rejected > 0) onToast(`File not supported or too large (max ${MAX_FILE_SIZE_MB}MB)`);
      return;
    }

    // Insert placeholders immediately
    setMedia((prev) => [...prev, ...accepted.map((a) => a.item)]);
    onToast(
      `Uploading ${accepted.length} file${accepted.length > 1 ? 's' : ''}…${rejected ? ` · ${rejected} rejected` : ''
      }`
    );

    // Upload in parallel
    await Promise.all(
      accepted.map(async ({ item, file }) => {
        try {
          const result = await adminApi.social.media.upload(file);
          setMedia((prev) =>
            prev.map((m) =>
              m.id === item.id
                ? { ...m, serverId: result.id, uploading: false, progress: 100 }
                : m
            )
          );
        } catch (err: any) {
          setMedia((prev) =>
            prev.map((m) =>
              m.id === item.id
                ? { ...m, uploading: false, error: err?.message ?? 'Upload failed' }
                : m
            )
          );
          onToast(`Failed to upload ${file.name}`);
        }
      })
    );
  };

  const removeFile = (id: string) => {
    setMedia((prev) => {
      const target = prev.find((m) => m.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((m) => m.id !== id);
    });
    onToast('File removed');
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    void addFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`w-full border-2 border-dashed rounded-sm px-3 py-4 text-center cursor-pointer transition ${isDragging
            ? 'border-blue-950 bg-blue-50/40'
            : 'border-slate-300 hover:border-blue-950 hover:bg-blue-50/20'
          }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void addFiles(e.target.files);
            if (fileRef.current) fileRef.current.value = '';
          }}
        />
        <ImageIcon className="w-5 h-5 mx-auto text-slate-400" />
        <p className="text-[13px] text-slate-700 font-medium mt-1">
          {isDragging ? 'Drop files here' : 'Drag & drop or click to upload'}
        </p>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Images &amp; videos · max {MAX_FILE_SIZE_MB}MB · up to {MAX_MEDIA_FILES} files
          {media.length > 0 && ` · ${media.length}/${MAX_MEDIA_FILES} used`}
        </p>
      </div>

      {media.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {media.map((m) => (
            <div
              key={m.id}
              className={`relative aspect-square rounded-sm overflow-hidden border bg-slate-100 group ${m.error ? 'border-red-300' : 'border-slate-200'
                }`}
            >
              {m.type === 'video' ? (
                <>
                  <video
                    src={m.url}
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-slate-900/30 pointer-events-none">
                    <span className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow">
                      <svg
                        viewBox="0 0 24 24"
                        className="w-3.5 h-3.5 fill-blue-950 ml-0.5"
                        aria-hidden
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </span>
                </>
              ) : (
                <img
                  src={m.url}
                  alt={m.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}

              {m.uploading && (
                <div className="absolute inset-x-0 bottom-0 bg-slate-900/70 text-white">
                  <div
                    className="h-0.5 bg-emerald-400 transition-all"
                    style={{ width: `${m.progress ?? 0}%` }}
                  />
                  <p className="text-[13px] text-center py-0.5">
                    Uploading…
                  </p>
                </div>
              )}

              {m.error && (
                <div className="absolute inset-x-0 bottom-0 bg-red-600 text-white">
                  <p className="text-[13px] text-center py-0.5">Failed</p>
                </div>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(m.id);
                }}
                aria-label={`Remove ${m.name}`}
                className="absolute top-1 right-1 h-5 w-5 rounded-sm bg-white/90 hover:bg-white text-red-600 flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>

              <span className="absolute bottom-1 left-1 bg-slate-900/70 text-white text-[13px] px-1.5 py-0.5 rounded-sm">
                {formatBytes(m.size)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}