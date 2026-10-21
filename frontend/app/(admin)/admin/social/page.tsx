'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Share2,
  Plus,
  CheckCircle2,
  XCircle,
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
  ChevronDown,
  Bell,
  LayoutDashboard,
  Calendar as CalendarIcon,
  ListChecks,
  Inbox,
  AtSign,
  FolderOpen,
  FileText,
  Users,
  Settings as SettingsIcon,
  FileBarChart,
  Copy,
  Pencil,
  CheckCheck,
  UserCheck,
  Shield,
  Search,
  Filter,
  Download,
} from 'lucide-react';
import {
  FaFacebookF,
  FaInstagram,
  FaTiktok,
  FaYoutube,
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
  AdminSocialEngagementPoint,
  AdminSocialFollowerPoint,
  AdminSocialPlatform,
  AdminSocialScheduledPost,
  AdminSocialPublishedPost,
  AdminSocialAccount,
  AdminSocialAccountDetail,
  AdminSocialMedia,
  AdminSocialMediaFolder,
  AdminSocialQueueSlot,
  AdminSocialEvergreenPost,
  AdminSocialDraft,
  AdminSocialInboxItem,
  AdminSocialTemplate,
  AdminSocialLink,
  AdminSocialNotification,
  AdminSocialTeamMember,
  AdminSocialAuditLog,
  AdminSocialReport,
  AdminSocialOverview,
  AdminSocialDemographicSnapshot,
  AdminSocialBestTimeRow,
  AdminSocialKpiAnalytics,
  AdminSocialPostWrite,
  AdminSocialInboxStatus,
  AdminSocialDraftStatus,
  AdminSocialTeamRole,
} from '@/lib/admin-types';

type SocialPlatform = AdminSocialPlatform;
type MediaType = 'image' | 'video';
type ToastKind = 'success' | 'error' | 'info';

type ViewKey =
  | 'overview'
  | 'scheduled'
  | 'calendar'
  | 'queue'
  | 'drafts'
  | 'inbox'
  | 'comments'
  | 'mentions'
  | 'published'
  | 'analytics'
  | 'reports'
  | 'media'
  | 'templates'
  | 'accounts'
  | 'team'
  | 'settings';

interface ToastState {
  kind: ToastKind;
  message: string;
}

interface ConnectedAccount {
  id: SocialPlatform;
  name: string;
  handle: string;
  connected: boolean;
  avatarBg: string;
  followers?: number;
  avatarUrl?: string;
}

interface MediaItem {
  id: string;
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
  scheduledTimeIso: string;
  mediaUrl?: string;
  productTag?: string;
  campaign?: string;
  status?: string;
}

interface PublishedPost {
  id: string;
  platform: SocialPlatform;
  caption: string;
  publishedAtIso: string | null;
  publishedAt: string;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  status?: string;
  errorMessage?: string;
  impressions?: number;
  saves?: number;
  videoViews?: number;
  linkClicks?: number;
  engagementRate?: number;
  platformUrl?: string;
}

const PLATFORMS: SocialPlatform[] = ['Facebook', 'Instagram', 'TikTok', 'YouTube'];

interface PlatformConfig {
  videoOnly: boolean;
  captionLimit: number;
  hint?: string;
}

const PLATFORM_CONFIG: Record<SocialPlatform, PlatformConfig> = {
  Facebook: { videoOnly: false, captionLimit: 63_206 },
  Instagram: { videoOnly: false, captionLimit: 2_200, hint: 'Feed posts only — no Stories via API.' },
  TikTok: { videoOnly: true, captionLimit: 2_200, hint: 'Video required. Vertical (9:16) looks best.' },
  YouTube: { videoOnly: true, captionLimit: 5_000, hint: 'Video required. Description, not a caption.' },
};

const PLATFORM_AVATAR_BG: Record<SocialPlatform, string> = {
  Facebook: 'bg-[#1877F2]',
  Instagram: 'bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]',
  TikTok: 'bg-black',
  YouTube: 'bg-[#FF0000]',
};

const PLATFORM_BADGE: Record<SocialPlatform, string> = {
  Facebook: 'bg-blue-50 text-[#1877F2] border-blue-100',
  Instagram: 'bg-pink-50 text-pink-700 border-pink-100',
  TikTok: 'bg-slate-100 text-slate-800 border-slate-200',
  YouTube: 'bg-red-50 text-[#FF0000] border-red-100',
};

const PlatformIcon = ({
  platform,
  className = 'w-3.5 h-3.5',
}: {
  platform: string;
  className?: string;
}) => {
  switch (platform) {
    case 'Facebook':  return <FaFacebookF className={className} />;
    case 'Instagram': return <FaInstagram className={className} />;
    case 'TikTok':    return <FaTiktok className={className} />;
    case 'YouTube':   return <FaYoutube className={className} />;
    default:          return null;
  }
};

const NAV_MENUS: {
  label: string;
  items: { key: ViewKey | 'composer'; label: string; icon: React.ComponentType<{ className?: string }> }[];
}[] = [
  {
    label: 'Create',
    items: [
      { key: 'composer', label: 'New post', icon: Plus },
      { key: 'drafts', label: 'Drafts', icon: FileText },
      { key: 'templates', label: 'Templates', icon: Sparkles },
      { key: 'media', label: 'Media library', icon: FolderOpen },
    ],
  },
  {
    label: 'Plan',
    items: [
      { key: 'calendar', label: 'Calendar', icon: CalendarIcon },
      { key: 'scheduled', label: 'Scheduled', icon: Clock },
      { key: 'queue', label: 'Queue slots', icon: ListChecks },
    ],
  },
  {
    label: 'Engage',
    items: [
      { key: 'inbox', label: 'Unified inbox', icon: Inbox },
      { key: 'comments', label: 'Comments', icon: MessageSquare },
      { key: 'mentions', label: 'Mentions', icon: AtSign },
    ],
  },
  {
    label: 'Insights',
    items: [
      { key: 'overview', label: 'Overview', icon: LayoutDashboard },
      { key: 'published', label: 'Published', icon: Send },
      { key: 'analytics', label: 'Analytics', icon: TrendingUp },
      { key: 'reports', label: 'Reports', icon: FileBarChart },
    ],
  },
  {
    label: 'Accounts',
    items: [
      { key: 'accounts', label: 'Connections', icon: Share2 },
      { key: 'team', label: 'Team', icon: Users },
      { key: 'settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
];

const VIEW_META: Record<string, { title: string; description: string; icon: React.ComponentType<{ className?: string }> }> = {
  overview:  { title: 'Overview',       description: 'Morning check-in — KPIs, alerts, upcoming queue, and activity.', icon: LayoutDashboard },
  calendar:  { title: 'Calendar',       description: 'Month, week, and list planning with drag-to-reschedule.',         icon: CalendarIcon },
  queue:     { title: 'Queue slots',    description: 'Define recurring time slots and drop posts into the next opening.', icon: ListChecks },
  drafts:    { title: 'Drafts',         description: 'Unpublished drafts, pending approvals, and rejection notes.',      icon: FileText },
  inbox:     { title: 'Unified inbox',  description: 'Comments, DMs, and mentions from every channel in one thread view.', icon: Inbox },
  comments:  { title: 'Comments',       description: 'Comment moderation queue across all connected channels.',          icon: MessageSquare },
  mentions:  { title: 'Mentions',       description: 'Brand handles and keywords picked up across platforms.',           icon: AtSign },
  media:     { title: 'Media library',  description: 'Reusable images and videos with folders, tags, and search.',       icon: FolderOpen },
  templates: { title: 'Templates',      description: 'Saved post structures you can reuse across campaigns.',            icon: Sparkles },
  reports:   { title: 'Reports',        description: 'Exportable, client-ready performance reports with branding.',      icon: FileBarChart },
  team:      { title: 'Team',           description: 'Roles, permissions, and audit trail for every action.',            icon: Users },
  settings:  { title: 'Settings',       description: 'Brand profile, timezone, defaults, and notification preferences.', icon: SettingsIcon },
};

const MAX_MEDIA_FILES = 5;
const MAX_FILE_SIZE_MB = 25;

const AVAILABLE_PRODUCTS = [
  'SokoFlow Pro Subscription',
  'Smart Home Wi-Fi Router AX3000',
  'Wireless Ergonomic Mechanical Keyboard',
  'UltraWide 29" Gaming Monitor',
  'USB-C Multiport Hub 7-in-1',
];

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const relativeTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
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

const toLocalDatetimeInputValue = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
};

export default function SocialMediaPage() {
  const [activeView, setActiveView] = useState<ViewKey>('overview');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [publishedPosts, setPublishedPosts] = useState<PublishedPost[]>([]);
  const [followerData, setFollowerData] = useState<AdminSocialFollowerPoint[]>([]);
  const [engagementData, setEngagementData] = useState<AdminSocialEngagementPoint[]>([]);

  const [overview, setOverview] = useState<AdminSocialOverview | null>(null);
  const [kpiAnalytics, setKpiAnalytics] = useState<AdminSocialKpiAnalytics | null>(null);
  const [demographics, setDemographics] = useState<AdminSocialDemographicSnapshot[]>([]);
  const [bestTimes, setBestTimes] = useState<AdminSocialBestTimeRow[]>([]);

  const [mediaLibrary, setMediaLibrary] = useState<AdminSocialMedia[]>([]);
  const [mediaFolders, setMediaFolders] = useState<AdminSocialMediaFolder[]>([]);
  const [queueSlots, setQueueSlots] = useState<AdminSocialQueueSlot[]>([]);
  const [evergreenPosts, setEvergreenPosts] = useState<AdminSocialEvergreenPost[]>([]);
  const [drafts, setDrafts] = useState<AdminSocialDraft[]>([]);
  const [inboxItems, setInboxItems] = useState<AdminSocialInboxItem[]>([]);
  const [templates, setTemplates] = useState<AdminSocialTemplate[]>([]);
  const [links, setLinks] = useState<AdminSocialLink[]>([]);
  const [notifications, setNotifications] = useState<AdminSocialNotification[]>([]);
  const [team, setTeam] = useState<AdminSocialTeamMember[]>([]);
  const [auditLog, setAuditLog] = useState<AdminSocialAuditLog[]>([]);
  const [reports, setReports] = useState<AdminSocialReport[]>([]);

  const [accountsLoading, setAccountsLoading] = useState(true);
  const [scheduledLoading, setScheduledLoading] = useState(true);
  const [publishedLoading, setPublishedLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);

  const [toast, setToast] = useState<ToastState | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<ConnectedAccount | null>(null);
  const [disconnectInFlight, setDisconnectInFlight] = useState(false);
  const [connectInFlight, setConnectInFlight] = useState<SocialPlatform | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [composerCaption, setComposerCaption] = useState('');
  const [composerFirstComment, setComposerFirstComment] = useState('');
  const [composerPlatforms, setComposerPlatforms] = useState<SocialPlatform[]>([]);
  const [composerProductTag, setComposerProductTag] = useState('');
  const [composerCampaign, setComposerCampaign] = useState('');
  const [composerScheduleTime, setComposerScheduleTime] = useState('');
  const [composerMedia, setComposerMedia] = useState<MediaItem[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [composerSubmitting, setComposerSubmitting] = useState(false);

  const composerMediaRef = useRef<MediaItem[]>([]);
  composerMediaRef.current = composerMedia;

  const notify = useCallback((message: string, kind: ToastKind = 'success') => {
    setToast({ message, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!openMenu) return;
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [openMenu]);

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
  }, [anyModalOpen, disconnectTarget, composerOpen]);

  useEffect(() => {
    return () => {
      composerMediaRef.current.forEach((m) => URL.revokeObjectURL(m.url));
    };
  }, []);

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const res = await adminApi.social.accounts.list();
      setAccounts(
        res
          .filter((a) => PLATFORMS.includes(a.id))
          .map((a) => ({
            id: a.id,
            name: a.name,
            handle: a.handle,
            connected: a.connected,
            avatarBg: PLATFORM_AVATAR_BG[a.id],
            followers: a.followers,
            avatarUrl: a.avatarUrl,
          })),
      );
    } catch (e: any) {
      notify(e?.message ?? 'Could not load accounts.', 'error');
    } finally {
      setAccountsLoading(false);
    }
  }, [notify]);

  const loadScheduled = useCallback(async () => {
    setScheduledLoading(true);
    try {
      const res = await adminApi.social.posts.listScheduled();
      const rows = res.results ?? [];
      setScheduledPosts(
        rows.map((p) => ({
          id: String(p.id),
          platforms: p.platforms.filter((plat) => PLATFORMS.includes(plat)),
          caption: p.caption,
          scheduledTimeIso: p.scheduledTime,
          mediaUrl: p.mediaUrl ?? undefined,
          productTag: p.productTag ?? undefined,
          campaign: p.campaign,
          status: p.status,
        })),
      );
    } catch (e: any) {
      notify(e?.message ?? 'Could not load scheduled posts.', 'error');
    } finally {
      setScheduledLoading(false);
    }
  }, [notify]);

  const loadPublished = useCallback(async () => {
    setPublishedLoading(true);
    try {
      const res = await adminApi.social.posts.listPublished();
      const rows = res.results ?? [];
      setPublishedPosts(
        rows
          .filter((p) => PLATFORMS.includes(p.platform))
          .map((p) => ({
            id: String(p.id),
            platform: p.platform,
            caption: p.caption,
            publishedAtIso: p.publishedAt,
            publishedAt: relativeTime(p.publishedAt),
            likes: p.likes,
            comments: p.comments,
            shares: p.shares,
            reach: p.reach,
            status: p.status,
            errorMessage: p.errorMessage,
            impressions: p.impressions,
            saves: p.saves,
            videoViews: p.videoViews,
            linkClicks: p.linkClicks,
            engagementRate: p.engagementRate,
            platformUrl: p.platformUrl,
          })),
      );
    } catch (e: any) {
      notify(e?.message ?? 'Could not load published posts.', 'error');
    } finally {
      setPublishedLoading(false);
    }
  }, [notify]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const [followers, engagement] = await Promise.all([
        adminApi.social.analytics.followers(5),
        adminApi.social.analytics.engagement(),
      ]);
      setFollowerData(followers);
      setEngagementData(engagement.filter((e) => PLATFORMS.includes(e.platform)));
      setAnalyticsLoaded(true);
    } catch (e: any) {
      notify(e?.message ?? 'Could not load analytics.', 'error');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [notify]);

  const loadOverview = useCallback(async () => {
    setViewLoading(true);
    try {
      const res = await adminApi.social.overview.get();
      setOverview(res);
    } catch (e: any) {
      notify(e?.message ?? 'Could not load overview.', 'error');
    } finally {
      setViewLoading(false);
    }
  }, [notify]);

  const loadMedia = useCallback(async () => {
    setViewLoading(true);
    try {
      const [library, folders] = await Promise.all([
        adminApi.social.media.library({ page_size: 100 }),
        adminApi.social.media.folders.list(),
      ]);
      setMediaLibrary(library.results ?? []);
      setMediaFolders(folders);
    } catch (e: any) {
      notify(e?.message ?? 'Could not load media.', 'error');
    } finally {
      setViewLoading(false);
    }
  }, [notify]);

  const loadQueue = useCallback(async () => {
    setViewLoading(true);
    try {
      const [slots, evergreen] = await Promise.all([
        adminApi.social.queue.slots.list(),
        adminApi.social.queue.evergreen.list({ page_size: 100 }),
      ]);
      setQueueSlots(slots);
      setEvergreenPosts(evergreen.results ?? []);
    } catch (e: any) {
      notify(e?.message ?? 'Could not load queue.', 'error');
    } finally {
      setViewLoading(false);
    }
  }, [notify]);

  const loadDrafts = useCallback(async () => {
    setViewLoading(true);
    try {
      const res = await adminApi.social.drafts.list({ page_size: 100 });
      setDrafts(res.results ?? []);
    } catch (e: any) {
      notify(e?.message ?? 'Could not load drafts.', 'error');
    } finally {
      setViewLoading(false);
    }
  }, [notify]);

  const loadInbox = useCallback(async () => {
    setViewLoading(true);
    try {
      const res = await adminApi.social.inbox.list({ page_size: 100 });
      setInboxItems(res.results ?? []);
    } catch (e: any) {
      notify(e?.message ?? 'Could not load inbox.', 'error');
    } finally {
      setViewLoading(false);
    }
  }, [notify]);

  const loadTemplates = useCallback(async () => {
    setViewLoading(true);
    try {
      const res = await adminApi.social.templates.list({ page_size: 100 });
      setTemplates(res.results ?? []);
    } catch (e: any) {
      notify(e?.message ?? 'Could not load templates.', 'error');
    } finally {
      setViewLoading(false);
    }
  }, [notify]);

  const loadLinks = useCallback(async () => {
    try {
      const res = await adminApi.social.links.list({ page_size: 100 });
      setLinks(res.results ?? []);
    } catch (e: any) {
      notify(e?.message ?? 'Could not load links.', 'error');
    }
  }, [notify]);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await adminApi.social.notifications.list({ page_size: 100 });
      setNotifications(res.results ?? []);
    } catch (e: any) {
      notify(e?.message ?? 'Could not load notifications.', 'error');
    }
  }, [notify]);

  const loadTeam = useCallback(async () => {
    setViewLoading(true);
    try {
      const res = await adminApi.social.team.list();
      setTeam(res);
    } catch (e: any) {
      notify(e?.message ?? 'Could not load team.', 'error');
    } finally {
      setViewLoading(false);
    }
  }, [notify]);

  const loadAuditLog = useCallback(async () => {
    try {
      const res = await adminApi.social.auditLog.list({ page_size: 100 });
      setAuditLog(res.results ?? []);
    } catch (e: any) {
      notify(e?.message ?? 'Could not load audit log.', 'error');
    }
  }, [notify]);

  const loadReports = useCallback(async () => {
    setViewLoading(true);
    try {
      const res = await adminApi.social.reports.list({ page_size: 100 });
      setReports(res.results ?? []);
    } catch (e: any) {
      notify(e?.message ?? 'Could not load reports.', 'error');
    } finally {
      setViewLoading(false);
    }
  }, [notify]);

  const loadAnalyticsExtras = useCallback(async () => {
    try {
      const [kpis, demo, best] = await Promise.all([
        adminApi.social.analytics.kpis(30),
        adminApi.social.analytics.demographics(),
        adminApi.social.analytics.bestTimes(),
      ]);
      setKpiAnalytics(kpis);
      setDemographics(demo);
      setBestTimes(best);
    } catch (e: any) {
      notify(e?.message ?? 'Could not load analytics details.', 'error');
    }
  }, [notify]);

  useEffect(() => {
    void loadAccounts();
    void loadScheduled();
    void loadPublished();
  }, [loadAccounts, loadScheduled, loadPublished]);

  useEffect(() => {
    const needsAnalytics =
      activeView === 'published' ||
      activeView === 'analytics' ||
      activeView === 'overview' ||
      activeView === 'reports';
    if (needsAnalytics && !analyticsLoaded && !analyticsLoading) {
      void loadAnalytics();
    }
  }, [activeView, analyticsLoaded, analyticsLoading, loadAnalytics]);

  useEffect(() => {
    switch (activeView) {
      case 'overview':  void loadOverview(); break;
      case 'media':     void loadMedia(); break;
      case 'queue':     void loadQueue(); break;
      case 'drafts':    void loadDrafts(); break;
      case 'inbox':
      case 'comments':
      case 'mentions':  void loadInbox(); break;
      case 'templates': void loadTemplates(); break;
      case 'team':      void loadTeam(); void loadAuditLog(); break;
      case 'reports':   void loadReports(); break;
      case 'analytics': void loadAnalyticsExtras(); break;
      default: break;
    }
  }, [
    activeView,
    loadOverview, loadMedia, loadQueue, loadDrafts,
    loadInbox, loadTemplates, loadTeam, loadAuditLog,
    loadReports, loadAnalyticsExtras,
  ]);

  const openComposer = () => {
    setComposerCaption('');
    setComposerFirstComment('');
    setComposerPlatforms(
      accounts.filter((a) => a.connected).map((a) => a.id).slice(0, 2),
    );
    setComposerProductTag('');
    setComposerCampaign('');
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
    setComposerFirstComment('');
    setComposerProductTag('');
    setComposerCampaign('');
    setComposerScheduleTime('');
    setIsScheduling(false);
    setComposerSubmitting(false);
  };

  const togglePlatformConnect = async (account: ConnectedAccount) => {
    if (account.connected) {
      setDisconnectTarget(account);
      return;
    }

    setConnectInFlight(account.id);
    try {
      const res = await adminApi.social.accounts.connect(account.id);

      if ('authUrl' in res) {
        window.location.href = res.authUrl;
        return;
      }

      setAccounts((prev) =>
        prev.map((a) =>
          a.id === account.id
            ? { ...a, connected: res.connected, handle: res.handle || a.handle }
            : a,
        ),
      );
      notify(`Connected to ${account.name}`);
    } catch (e: any) {
      notify(e?.message ?? 'Could not connect.', 'error');
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
      notify(`Disconnected from ${disconnectTarget.name}`, 'info');
      setDisconnectTarget(null);
    } catch (e: any) {
      notify(e?.message ?? 'Disconnect failed.', 'error');
    } finally {
      setDisconnectInFlight(false);
    }
  };

  const composerHasVideo = useMemo(
    () => composerMedia.some((m) => m.type === 'video'),
    [composerMedia],
  );

  const videoRequiredPlatforms = useMemo(
    () =>
      composerPlatforms.filter(
        (p) => PLATFORM_CONFIG[p].videoOnly && !composerHasVideo,
      ),
    [composerPlatforms, composerHasVideo],
  );

  const tightestCaptionLimit = useMemo(() => {
    if (composerPlatforms.length === 0) return null;
    return Math.min(...composerPlatforms.map((p) => PLATFORM_CONFIG[p].captionLimit));
  }, [composerPlatforms]);

  const captionOverLimit =
    tightestCaptionLimit !== null && composerCaption.length > tightestCaptionLimit;

  const publishOrSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (composerSubmitting) return;
    if (!composerCaption.trim() || composerPlatforms.length === 0) return;

    const stillUploading = composerMedia.some((m) => m.uploading);
    if (stillUploading) {
      notify('Wait for uploads to finish.', 'error');
      return;
    }
    const uploadErrors = composerMedia.filter((m) => m.error);
    if (uploadErrors.length > 0) {
      notify('Remove failed uploads before posting.', 'error');
      return;
    }

    if (videoRequiredPlatforms.length > 0) {
      notify(
        `${videoRequiredPlatforms.join(' and ')} require a video. Attach one or uncheck the platform.`,
        'error',
      );
      return;
    }

    if (captionOverLimit && tightestCaptionLimit !== null) {
      notify(
        `Caption is ${composerCaption.length - tightestCaptionLimit} characters over the platform limit.`,
        'error',
      );
      return;
    }

    let scheduleAt: string | null = null;
    if (isScheduling) {
      if (!composerScheduleTime.trim()) {
        notify('Pick a time for the scheduled post.', 'error');
        return;
      }
      const dt = new Date(composerScheduleTime);
      if (Number.isNaN(dt.getTime()) || dt <= new Date()) {
        notify('Scheduled time must be in the future.', 'error');
        return;
      }
      scheduleAt = dt.toISOString();
    }

    setComposerSubmitting(true);
    try {
      const mediaIds = composerMedia
        .filter((m) => m.serverId !== undefined)
        .map((m) => m.serverId as number);

      const payload: AdminSocialPostWrite = {
        caption: composerCaption,
        platforms: composerPlatforms,
        ...(composerProductTag ? { productTag: composerProductTag } : {}),
        ...(composerFirstComment ? { firstComment: composerFirstComment } : {}),
        ...(composerCampaign ? { campaign: composerCampaign } : {}),
        ...(mediaIds.length > 0 ? { mediaIds } : {}),
        ...(scheduleAt ? { scheduleAt } : {}),
      };

      await adminApi.social.posts.create(payload);

      if (scheduleAt) {
        notify('Post scheduled');
        setActiveView('scheduled');
        await loadScheduled();
      } else {
        notify(`Publishing to ${composerPlatforms.join(', ')}...`, 'info');
        setActiveView('published');
        await loadPublished();
        setTimeout(() => void loadPublished(), 2000);
        setTimeout(() => void loadPublished(), 5000);
      }

      closeComposer();
    } catch (e: any) {
      notify(e?.message ?? 'Could not submit the post.', 'error');
    } finally {
      setComposerSubmitting(false);
    }
  };

  const deleteScheduled = async (id: string) => {
    const prev = scheduledPosts;
    setScheduledPosts((p) => p.filter((x) => x.id !== id));
    try {
      await adminApi.social.posts.remove(id);
      notify('Scheduled post deleted', 'info');
    } catch (e: any) {
      setScheduledPosts(prev);
      notify(e?.message ?? 'Could not delete.', 'error');
    }
  };

  const postNowFromScheduled = async (post: ScheduledPost) => {
    const prev = scheduledPosts;
    setScheduledPosts((p) => p.filter((x) => x.id !== post.id));
    try {
      await adminApi.social.posts.publishNow(post.id);
      notify('Publishing...', 'info');
      setActiveView('published');
      await loadPublished();
      setTimeout(() => void loadPublished(), 2000);
      setTimeout(() => void loadPublished(), 5000);
    } catch (e: any) {
      setScheduledPosts(prev);
      notify(e?.message ?? 'Could not publish.', 'error');
    }
  };

  const duplicateScheduled = async (post: ScheduledPost) => {
    try {
      const dt = new Date(post.scheduledTimeIso);
      const next = new Date(dt.getTime() + 24 * 60 * 60 * 1000);
      await adminApi.social.posts.create({
        caption: post.caption,
        platforms: post.platforms,
        ...(post.productTag ? { productTag: post.productTag } : {}),
        scheduleAt: next.toISOString(),
      });
      notify('Duplicated for tomorrow');
      await loadScheduled();
    } catch (e: any) {
      notify(e?.message ?? 'Could not duplicate.', 'error');
    }
  };

  const platformBadge = (p: SocialPlatform): string =>
    PLATFORM_BADGE[p] ?? 'bg-slate-100 text-slate-800 border-slate-200';

  const connectedAccounts = accounts.filter((a) => a.connected);

  const activeMenuLabel = useMemo(() => {
    for (const menu of NAV_MENUS) {
      if (menu.items.some((i) => i.key === activeView)) return menu.label;
    }
    return null;
  }, [activeView]);

  const handleNavClick = (key: ViewKey | 'composer') => {
    setOpenMenu(null);
    if (key === 'composer') {
      openComposer();
      return;
    }
    setActiveView(key);
  };

  const renderOverviewView = () => {
    if (viewLoading && !overview) {
      return (
        <div className="bg-white border border-slate-200 rounded-sm p-8 text-center text-slate-400 text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
          Loading overview...
        </div>
      );
    }
    if (!overview) {
      return (
        <div className="bg-white border border-slate-200 rounded-sm p-8 text-center text-slate-400 text-[13px]">
          No overview data yet.
        </div>
      );
    }

    const kpis = [
      { label: 'Followers',     value: overview.kpis.total_followers.toLocaleString(), icon: Users },
      { label: 'Reach (30d)',   value: overview.kpis.reach.toLocaleString(),           icon: TrendingUp },
      { label: 'Engagement',    value: `${overview.kpis.engagement_rate}%`,            icon: ThumbsUp },
      { label: 'Published',     value: String(overview.kpis.posts_published),          icon: Send },
      { label: 'Scheduled',     value: String(overview.kpis.scheduled_this_week),      icon: Clock },
      { label: 'Unread inbox',  value: String(overview.kpis.unread_inbox),             icon: Inbox },
      { label: 'Failed posts',  value: String(overview.kpis.failed_posts),             icon: AlertCircle },
    ];

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="bg-white border border-slate-200 rounded-sm p-2">
                <div className="flex items-center gap-2 text-slate-500 text-[13px]">
                  <Icon className="w-3 h-3" />
                  {k.label}
                </div>
                <p className="text-[15px] font-semibold text-slate-900 mt-2">{k.value}</p>
              </div>
            );
          })}
        </div>

        {overview.expiring_tokens.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-sm p-2 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-[13px] text-amber-900">
              <p className="font-medium">Tokens expiring soon</p>
              <ul className="mt-2 space-y-2">
                {overview.expiring_tokens.map((t) => (
                  <li key={t.platform}>
                    {t.platform} — expires {relativeTime(t.expires_at)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="px-2 py-2 border-b border-slate-200 bg-slate-50">
              <p className="text-[13px] font-medium text-slate-700">Upcoming queue</p>
            </div>
            <div className="divide-y divide-slate-100">
              {overview.upcoming.length === 0 ? (
                <p className="text-[13px] text-slate-400 p-8 text-center">No upcoming posts.</p>
              ) : (
                overview.upcoming.map((p) => (
                  <div key={p.id} className="p-2 flex items-center justify-between gap-2 text-[13px]">
                    <span className="text-slate-700 truncate">{p.caption}</span>
                    <span className="text-slate-400 shrink-0">
                      {formatScheduledTime(p.scheduledTime)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="px-2 py-2 border-b border-slate-200 bg-slate-50">
              <p className="text-[13px] font-medium text-slate-700">Recent activity</p>
            </div>
            <div className="divide-y divide-slate-100">
              {overview.recent_activity.length === 0 ? (
                <p className="text-[13px] text-slate-400 p-8 text-center">No recent activity.</p>
              ) : (
                overview.recent_activity.map((a) => (
                  <div key={a.id} className="p-2 text-[13px]">
                    <p className="text-slate-800">
                      <span className="font-medium">{a.actorName || 'System'}</span> — {a.action}
                    </p>
                    <p className="text-slate-400 text-[13px]">{relativeTime(a.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="px-2 py-2 border-b border-slate-200 bg-slate-50">
            <p className="text-[13px] font-medium text-slate-700">Top performing posts</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2 px-2 font-medium">Platform</th>
                  <th className="py-2 px-2 font-medium">Caption</th>
                  <th className="py-2 px-2 font-medium text-right">Reach</th>
                  <th className="py-2 px-2 font-medium text-right">Engagement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview.top_posts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 text-[13px]">No posts yet.</td>
                  </tr>
                ) : (
                  overview.top_posts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2 px-2">
                        <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-sm font-medium border text-[13px] ${platformBadge(p.platform)}`}>
                          <PlatformIcon platform={p.platform} className="w-3 h-3" />
                          {p.platform}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-slate-700 truncate max-w-xs">{p.caption}</td>
                      <td className="py-2 px-2 text-right font-mono text-blue-950">{p.reach.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right font-mono text-emerald-700">
                        {p.likes + p.comments + p.shares}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAccountsSection = () => (
    <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-slate-900 inline-flex items-center gap-2">
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
            className="p-2 rounded-sm hover:bg-slate-100 text-slate-500 disabled:opacity-40"
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
        <div className="py-8 flex items-center justify-center text-slate-400 text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Loading accounts...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {accounts.map((acc) => {
            const isConnecting = connectInFlight === acc.id;
            return (
              <div
                key={acc.id}
                className={`bg-white border rounded-sm p-2 flex items-center justify-between gap-2 ${
                  acc.connected
                    ? 'border-emerald-200 ring-1 ring-emerald-100'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-9 h-9 rounded-sm ${PLATFORM_AVATAR_BG[acc.id] ?? 'bg-slate-700'} text-white font-semibold text-[13px] flex items-center justify-center shrink-0`}
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
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span
                        className={`inline-block px-2 py-1 rounded-sm text-[13px] font-medium border ${
                          acc.connected
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {acc.connected ? 'Connected' : 'Disconnected'}
                      </span>
                      {typeof acc.followers === 'number' && acc.followers > 0 && (
                        <span className="text-[13px] text-slate-500">
                          {acc.followers.toLocaleString()} followers
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => void togglePlatformConnect(acc)}
                  disabled={isConnecting}
                  className={`px-2 py-2 rounded-sm font-medium text-[13px] transition shrink-0 border disabled:opacity-50 ${
                    acc.connected
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
  );

  const renderScheduledView = () => (
    <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
      <div className="px-2 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <p className="text-[13px] font-medium text-slate-700">
          Upcoming scheduled posts · {scheduledPosts.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadScheduled()}
            disabled={scheduledLoading}
            aria-label="Refresh scheduled posts"
            className="p-2 rounded-sm hover:bg-slate-100 text-slate-500 disabled:opacity-40"
          >
            {scheduledLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={openComposer}
            className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-2"
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
              <th className="py-2 px-2 font-medium">Platforms</th>
              <th className="py-2 px-2 font-medium">Caption</th>
              <th className="py-2 px-2 font-medium">Campaign</th>
              <th className="py-2 px-2 font-medium">Scheduled</th>
              <th className="py-2 px-2 w-52"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {scheduledLoading && scheduledPosts.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400 text-[13px]">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading scheduled posts...
                  </div>
                </td>
              </tr>
            ) : scheduledPosts.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400 text-[13px]">
                  No scheduled posts yet. Click{' '}
                  <span className="font-medium text-slate-600">Create post</span> to add one.
                </td>
              </tr>
            ) : (
              scheduledPosts.map((post) => (
                <tr key={post.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-2">
                    <div className="flex flex-wrap gap-2">
                      {post.platforms.map((p) => (
                        <span
                          key={p}
                          className={`inline-flex items-center gap-2 px-2 py-1 rounded-sm font-medium border text-[13px] ${platformBadge(p)}`}
                        >
                          <PlatformIcon platform={p} className="w-3 h-3" />
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-slate-600 truncate max-w-sm">
                    {post.caption}
                  </td>
                  <td className="py-2 px-2 text-slate-500">{post.campaign || '—'}</td>
                  <td className="py-2 px-2 text-blue-950 font-medium">
                    <span className="inline-flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {formatScheduledTime(post.scheduledTimeIso)}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => void postNowFromScheduled(post)}
                        className="px-2 py-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-[13px]"
                      >
                        Post now
                      </button>
                      <button
                        onClick={() => void duplicateScheduled(post)}
                        aria-label="Duplicate"
                        className="p-2 rounded-sm bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                      >
                        <Copy className="w-3.5 h-3.5" />
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
  );

  const renderCalendarView = () => {
    const now = new Date();
    const days: { date: Date; items: ScheduledPost[] }[] = [];
    for (let i = -3; i <= 27; i++) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + i);
      const items = scheduledPosts.filter((p) => {
        const t = new Date(p.scheduledTimeIso);
        return (
          t.getFullYear() === d.getFullYear() &&
          t.getMonth() === d.getMonth() &&
          t.getDate() === d.getDate()
        );
      });
      days.push({ date: d, items });
    }

    return (
      <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-slate-900 inline-flex items-center gap-2">
            <CalendarIcon className="w-3.5 h-3.5 text-blue-950" />
            Next 30 days · {scheduledPosts.length} scheduled
          </p>
          <button
            onClick={() => void loadScheduled()}
            className="p-2 rounded-sm hover:bg-slate-100 text-slate-500"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {days.map(({ date, items }) => {
            const isToday = date.toDateString() === now.toDateString();
            return (
              <div
                key={date.toISOString()}
                className={`border rounded-sm p-2 min-h-[84px] ${
                  isToday ? 'border-blue-950 bg-blue-50/40' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium text-slate-700">
                    {date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                  </p>
                  {items.length > 0 && (
                    <span className="text-[13px] text-slate-400">{items.length}</span>
                  )}
                </div>
                <div className="mt-2 space-y-2">
                  {items.slice(0, 3).map((p) => (
                    <div
                      key={p.id}
                      className="text-[13px] truncate text-slate-600 bg-slate-50 border border-slate-100 rounded-sm px-2 py-1"
                    >
                      {p.platforms.map((pl) => (
                        <PlatformIcon key={pl} platform={pl} className="inline w-2.5 h-2.5 mr-1" />
                      ))}
                      {p.caption}
                    </div>
                  ))}
                  {items.length > 3 && (
                    <p className="text-[13px] text-slate-400">+{items.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderQueueView = () => (
    <div className="space-y-2">
      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="px-2 py-2 border-b border-slate-200 bg-slate-50">
          <p className="text-[13px] font-medium text-slate-700">
            Queue slots · {queueSlots.length}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-2 px-2 font-medium">Name</th>
                <th className="py-2 px-2 font-medium">Kind</th>
                <th className="py-2 px-2 font-medium">Days</th>
                <th className="py-2 px-2 font-medium">Time</th>
                <th className="py-2 px-2 font-medium">Platforms</th>
                <th className="py-2 px-2 font-medium">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {queueSlots.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-[13px]">
                    No queue slots yet.
                  </td>
                </tr>
              ) : (
                queueSlots.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2 font-medium text-slate-800">{s.name}</td>
                    <td className="py-2 px-2 text-slate-600">{s.kind}</td>
                    <td className="py-2 px-2 text-slate-600">{s.days.join(', ')}</td>
                    <td className="py-2 px-2 text-slate-600">{s.timeOfDay}</td>
                    <td className="py-2 px-2">
                      <div className="flex flex-wrap gap-2">
                        {s.platforms.map((p) => (
                          <span key={p} className={`inline-flex items-center gap-2 px-2 py-1 rounded-sm font-medium border text-[13px] ${platformBadge(p)}`}>
                            <PlatformIcon platform={p} className="w-3 h-3" />
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`inline-block px-2 py-1 rounded-sm text-[13px] font-medium border ${
                        s.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {s.isActive ? 'Active' : 'Paused'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="px-2 py-2 border-b border-slate-200 bg-slate-50">
          <p className="text-[13px] font-medium text-slate-700">
            Evergreen pool · {evergreenPosts.length}
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {evergreenPosts.length === 0 ? (
            <p className="text-[13px] text-slate-400 p-8 text-center">
              No evergreen posts yet.
            </p>
          ) : (
            evergreenPosts.map((p) => (
              <div key={p.id} className="p-2 text-[13px] flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-slate-700 truncate">{p.caption}</p>
                  <p className="text-slate-400 text-[13px] mt-2">
                    Used {p.useCount}× · last used {relativeTime(p.lastUsedAt)}
                  </p>
                </div>
                <span className={`inline-block px-2 py-1 rounded-sm text-[13px] font-medium border shrink-0 ${
                  p.isActive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  {p.isActive ? 'Active' : 'Paused'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderDraftsView = () => {
    const statusBadge = (s: AdminSocialDraftStatus) => {
      const map: Record<AdminSocialDraftStatus, string> = {
        DRAFT:     'bg-slate-100 text-slate-700 border-slate-200',
        PENDING:   'bg-amber-50 text-amber-700 border-amber-100',
        APPROVED:  'bg-emerald-50 text-emerald-700 border-emerald-100',
        REJECTED:  'bg-red-50 text-red-700 border-red-100',
        SCHEDULED: 'bg-blue-50 text-blue-950 border-blue-100',
      };
      return map[s] ?? 'bg-slate-100 text-slate-700 border-slate-200';
    };

    const approve = async (id: number) => {
      try {
        await adminApi.social.drafts.approve(id);
        notify('Draft approved');
        await loadDrafts();
      } catch (e: any) {
        notify(e?.message ?? 'Approve failed.', 'error');
      }
    };

    const reject = async (id: number) => {
      try {
        await adminApi.social.drafts.reject(id);
        notify('Draft rejected', 'info');
        await loadDrafts();
      } catch (e: any) {
        notify(e?.message ?? 'Reject failed.', 'error');
      }
    };

    return (
      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="px-2 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <p className="text-[13px] font-medium text-slate-700">Drafts · {drafts.length}</p>
          <button
            onClick={() => void loadDrafts()}
            className="p-2 rounded-sm hover:bg-slate-100 text-slate-500"
          >
            {viewLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {drafts.length === 0 ? (
            <p className="text-[13px] text-slate-400 p-8 text-center">No drafts yet.</p>
          ) : (
            drafts.map((d) => (
              <div key={d.id} className="p-2 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-900 truncate">
                      {d.title || `Draft #${d.id}`}
                    </p>
                    <p className="text-[13px] text-slate-500 truncate mt-2">{d.caption}</p>
                    <p className="text-[13px] text-slate-400 mt-2">
                      {d.authorName || 'Unknown author'} · edited {relativeTime(d.last_edited_at)}
                    </p>
                  </div>
                  <span className={`inline-block px-2 py-1 rounded-sm text-[13px] font-medium border shrink-0 ${statusBadge(d.status)}`}>
                    {d.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {d.platforms.map((p) => (
                    <span key={p} className={`inline-flex items-center gap-2 px-2 py-1 rounded-sm font-medium border text-[13px] ${platformBadge(p)}`}>
                      <PlatformIcon platform={p} className="w-3 h-3" />
                      {p}
                    </span>
                  ))}
                </div>
                {d.comments.length > 0 && (
                  <div className="bg-slate-50 border border-slate-100 rounded-sm p-2 space-y-2">
                    {d.comments.slice(0, 2).map((c) => (
                      <p key={c.id} className="text-[13px] text-slate-600">
                        <span className="font-medium text-slate-800">{c.authorName}:</span>{' '}
                        {c.body}
                      </p>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void approve(d.id)}
                    className="inline-flex items-center gap-2 px-2 py-2 rounded-sm bg-blue-950 hover:bg-blue-900 text-white font-medium text-[13px]"
                  >
                    <CheckCheck className="w-3 h-3" /> Approve
                  </button>
                  <button
                    onClick={() => void reject(d.id)}
                    className="inline-flex items-center gap-2 px-2 py-2 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 font-medium text-[13px]"
                  >
                    <XCircle className="w-3 h-3" /> Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderInboxView = (filterType?: 'COMMENT' | 'DM' | 'MENTION') => {
    const items = filterType
      ? inboxItems.filter((i) => i.itemType === filterType)
      : inboxItems;

    const sentimentBadge = (s: string) => {
      if (s === 'POSITIVE') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      if (s === 'NEGATIVE') return 'bg-red-50 text-red-700 border-red-100';
      return 'bg-slate-100 text-slate-600 border-slate-200';
    };

    const reply = async (item: AdminSocialInboxItem) => {
      const body = window.prompt('Reply:');
      if (!body?.trim()) return;
      try {
        await adminApi.social.inbox.reply(item.id, body);
        notify('Reply sent');
        await loadInbox();
      } catch (e: any) {
        notify(e?.message ?? 'Reply failed.', 'error');
      }
    };

    const setStatus = async (id: number, status: AdminSocialInboxStatus) => {
      try {
        await adminApi.social.inbox.setStatus(id, status);
        notify(`Marked ${status.toLowerCase()}`);
        await loadInbox();
      } catch (e: any) {
        notify(e?.message ?? 'Update failed.', 'error');
      }
    };

    return (
      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="px-2 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <p className="text-[13px] font-medium text-slate-700">
            {filterType ? filterType : 'All'} items · {items.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                void adminApi.social.inbox.sync().then(() => loadInbox()).catch(() => {});
              }}
              className="text-[13px] text-blue-950 hover:underline inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3 h-3" /> Sync
            </button>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {viewLoading && items.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-[13px]">
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
              Loading...
            </div>
          ) : items.length === 0 ? (
            <p className="text-[13px] text-slate-400 p-8 text-center">
              No {filterType ? filterType.toLowerCase() + 's' : 'items'} yet.
            </p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="p-2 space-y-2">
                <div className="flex items-start gap-2">
                  <span className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 text-[13px] font-semibold ${PLATFORM_AVATAR_BG[item.platform] ?? 'bg-slate-700'} text-white`}>
                    {item.authorName.slice(0, 1).toUpperCase() || '?'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-medium text-slate-900">
                        {item.authorName || item.authorHandle || 'Unknown'}
                      </p>
                      <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-sm font-medium border text-[13px] ${platformBadge(item.platform)}`}>
                        <PlatformIcon platform={item.platform} className="w-3 h-3" />
                        {item.platform}
                      </span>
                      <span className={`inline-block px-2 py-1 rounded-sm text-[13px] font-medium border ${sentimentBadge(item.sentiment)}`}>
                        {item.sentiment}
                      </span>
                      <span className="text-[13px] text-slate-400">{relativeTime(item.receivedAt)}</span>
                    </div>
                    <p className="text-[13px] text-slate-700 mt-2 whitespace-pre-wrap">{item.body}</p>
                    {item.postCaption && (
                      <p className="text-[13px] text-slate-400 mt-2">
                        On: {item.postCaption.slice(0, 80)}
                      </p>
                    )}
                    {item.replies.length > 0 && (
                      <div className="mt-2 bg-slate-50 border border-slate-100 rounded-sm p-2 space-y-2">
                        {item.replies.map((r) => (
                          <p key={r.id} className="text-[13px] text-slate-600">
                            <span className="font-medium text-slate-800">
                              {r.authorName || 'You'}:
                            </span>{' '}
                            {r.body}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-10">
                  <button
                    onClick={() => void reply(item)}
                    className="inline-flex items-center gap-2 px-2 py-2 rounded-sm bg-blue-950 hover:bg-blue-900 text-white font-medium text-[13px]"
                  >
                    <Send className="w-3 h-3" /> Reply
                  </button>
                  <button
                    onClick={() => void setStatus(item.id, 'RESOLVED')}
                    className="inline-flex items-center gap-2 px-2 py-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-[13px]"
                  >
                    <CheckCheck className="w-3 h-3" /> Resolve
                  </button>
                  <button
                    onClick={() => void setStatus(item.id, 'SPAM')}
                    className="inline-flex items-center gap-2 px-2 py-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 font-medium text-[13px]"
                  >
                    <XCircle className="w-3 h-3" /> Spam
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderPublishedView = () => (
    <div className="space-y-2">
      <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
        <p className="text-[13px] font-semibold text-slate-900 inline-flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-blue-950" />
          Platform engagement comparison
        </p>
        <div className="h-56 w-full">
          {analyticsLoading && engagementData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-[13px]">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Loading chart...
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
        <div className="px-2 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <p className="text-[13px] font-medium text-slate-700">
            Published posts &amp; analytics · {publishedPosts.length}
          </p>
          <button
            onClick={() => void loadPublished()}
            disabled={publishedLoading}
            aria-label="Refresh published posts"
            className="p-2 rounded-sm hover:bg-slate-100 text-slate-500 disabled:opacity-40"
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
                <th className="py-2 px-2 font-medium">Platform</th>
                <th className="py-2 px-2 font-medium">Caption</th>
                <th className="py-2 px-2 font-medium">Published</th>
                <th className="py-2 px-2 font-medium text-center">Likes</th>
                <th className="py-2 px-2 font-medium text-center">Comments</th>
                <th className="py-2 px-2 font-medium text-center">Shares</th>
                <th className="py-2 px-2 font-medium text-right">Reach</th>
                <th className="py-2 px-2 font-medium text-right">ER%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {publishedLoading && publishedPosts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-[13px]">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading published posts...
                    </div>
                  </td>
                </tr>
              ) : publishedPosts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-[13px]">
                    No published posts yet. Posts you publish from the composer will appear here.
                  </td>
                </tr>
              ) : (
                publishedPosts.map((pub) => (
                  <tr key={pub.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-2">
                      <span
                        className={`inline-flex items-center gap-2 px-2 py-1 rounded-sm font-medium border text-[13px] ${platformBadge(pub.platform)}`}
                      >
                        <PlatformIcon platform={pub.platform} className="w-3 h-3" />
                        {pub.platform}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-slate-700 truncate max-w-xs">
                      {pub.caption}
                    </td>
                    <td className="py-2 px-2 text-slate-400">{pub.publishedAt}</td>
                    <td className="py-2 px-2 text-center font-medium text-slate-900">
                      {pub.likes.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-700">{pub.comments}</td>
                    <td className="py-2 px-2 text-center text-slate-700">{pub.shares}</td>
                    <td className="py-2 px-2 text-right font-mono text-blue-950">
                      {pub.reach.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-emerald-700">
                      {typeof pub.engagementRate === 'number' ? `${pub.engagementRate}%` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderAnalyticsView = () => (
    <div className="space-y-2">
      {kpiAnalytics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { label: 'Reach',           value: kpiAnalytics.current.reach.toLocaleString(),           delta: kpiAnalytics.deltas.reach },
            { label: 'Engagement',      value: kpiAnalytics.current.engagement.toLocaleString(),      delta: kpiAnalytics.deltas.engagement },
            { label: 'ER %',            value: `${kpiAnalytics.current.engagement_rate}%`,             delta: kpiAnalytics.deltas.engagement_rate },
            { label: 'Link clicks',     value: kpiAnalytics.current.link_clicks.toLocaleString(),     delta: kpiAnalytics.deltas.link_clicks },
            { label: 'Posts',           value: kpiAnalytics.current.posts.toLocaleString(),           delta: kpiAnalytics.deltas.posts },
          ].map((k) => (
            <div key={k.label} className="bg-white border border-slate-200 rounded-sm p-2">
              <p className="text-[13px] text-slate-500">{k.label}</p>
              <p className="text-[15px] font-semibold text-slate-900 mt-2">{k.value}</p>
              <p className={`text-[13px] mt-2 ${k.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {k.delta >= 0 ? '+' : ''}{k.delta}%
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
          <p className="text-[13px] font-semibold text-slate-900 inline-flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-blue-950" />
            Follower growth over time
          </p>
          <div className="h-64 w-full">
            {analyticsLoading && followerData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-[13px]">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Loading chart...
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
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
          <p className="text-[13px] font-semibold text-slate-900 inline-flex items-center gap-2">
            <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
            Engagement by platform
          </p>
          <div className="h-64 w-full">
            {analyticsLoading && engagementData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-[13px]">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Loading chart...
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

      {demographics.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
          <p className="text-[13px] font-semibold text-slate-900">Demographics</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {demographics.map((d) => (
              <div key={d.id} className="border border-slate-100 rounded-sm p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-sm font-medium border text-[13px] ${platformBadge(d.platform)}`}>
                    <PlatformIcon platform={d.platform} className="w-3 h-3" />
                    {d.platform}
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="text-[13px] font-medium text-slate-700">Age</p>
                  {Object.entries(d.ageBuckets).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 text-[13px]">
                      <span className="text-slate-500 w-12">{k}</span>
                      <div className="flex-1 bg-slate-100 h-1.5 rounded-sm overflow-hidden">
                        <div className="bg-blue-950 h-full" style={{ width: `${Math.min(v, 100)}%` }} />
                      </div>
                      <span className="text-slate-600 font-mono w-10 text-right">{v}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {bestTimes.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
          <p className="text-[13px] font-semibold text-slate-900">Best time to post</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {PLATFORMS.map((plat) => {
              const rows = bestTimes.filter((b) => b.platform === plat);
              if (rows.length === 0) return null;
              return (
                <div key={plat} className="border border-slate-100 rounded-sm p-2 space-y-2">
                  <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-sm font-medium border text-[13px] ${platformBadge(plat)}`}>
                    <PlatformIcon platform={plat} className="w-3 h-3" />
                    {plat}
                  </span>
                  <div className="grid grid-cols-8 gap-2">
                    {Array.from({ length: 7 }).map((_, day) =>
                      [7, 9, 11, 13, 15, 17, 19, 21].map((hour) => {
                        const score = rows.find((r) => r.dayOfWeek === day && r.hour === hour)?.score ?? 0;
                        const intensity = Math.min(1, score);
                        return (
                          <div
                            key={`${day}-${hour}`}
                            className="aspect-square rounded-sm border border-slate-100"
                            style={{ backgroundColor: `rgba(23, 37, 84, ${intensity})` }}
                            title={`Day ${day} ${hour}:00 — ${(score * 100).toFixed(0)}%`}
                          />
                        );
                      }),
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderMediaView = () => (
    <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-slate-900 inline-flex items-center gap-2">
          <FolderOpen className="w-3.5 h-3.5 text-blue-950" />
          Media library · {mediaLibrary.length}
        </p>
        <button
          onClick={() => void loadMedia()}
          className="p-2 rounded-sm hover:bg-slate-100 text-slate-500"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {mediaFolders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {mediaFolders.map((f) => (
            <span key={f.id} className="text-[13px] px-2 py-1 rounded-sm bg-slate-100 text-slate-700 border border-slate-200">
              {f.name}
            </span>
          ))}
        </div>
      )}

      {viewLoading && mediaLibrary.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading media...
        </div>
      ) : mediaLibrary.length === 0 ? (
        <p className="text-[13px] text-slate-400 py-8 text-center">No media yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {mediaLibrary.map((m) => (
            <div key={m.id} className="border border-slate-200 rounded-sm overflow-hidden">
              <div className="aspect-square bg-slate-100 relative">
                {m.mediaType === 'VIDEO' || m.media_type === 'VIDEO' ? (
                  <video src={m.url} muted playsInline className="w-full h-full object-cover" />
                ) : (
                  <img src={m.url} alt={m.filename} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="p-2">
                <p className="text-[13px] text-slate-700 truncate">{m.title || m.filename}</p>
                <p className="text-[13px] text-slate-400">
                  {formatBytes(m.sizeBytes ?? m.size ?? 0)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTemplatesView = () => (
    <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
      <div className="px-2 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <p className="text-[13px] font-medium text-slate-700">Templates · {templates.length}</p>
        <button
          onClick={() => void loadTemplates()}
          className="p-2 rounded-sm hover:bg-slate-100 text-slate-500"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="divide-y divide-slate-100">
        {templates.length === 0 ? (
          <p className="text-[13px] text-slate-400 p-8 text-center">No templates yet.</p>
        ) : (
          templates.map((t) => (
            <div key={t.id} className="p-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-slate-900">{t.name}</p>
                <span className="text-[13px] px-2 py-1 rounded-sm bg-slate-100 text-slate-600 border border-slate-200">
                  {t.category}
                </span>
              </div>
              <p className="text-[13px] text-slate-500 truncate">{t.caption}</p>
              <div className="flex flex-wrap gap-2">
                {t.platforms.map((p) => (
                  <span key={p} className={`inline-flex items-center gap-2 px-2 py-1 rounded-sm font-medium border text-[13px] ${platformBadge(p)}`}>
                    <PlatformIcon platform={p} className="w-3 h-3" />
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderReportsView = () => (
    <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
      <div className="px-2 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <p className="text-[13px] font-medium text-slate-700">Reports · {reports.length}</p>
        <button
          onClick={() => void loadReports()}
          className="p-2 rounded-sm hover:bg-slate-100 text-slate-500"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <th className="py-2 px-2 font-medium">Name</th>
              <th className="py-2 px-2 font-medium">Range</th>
              <th className="py-2 px-2 font-medium">Format</th>
              <th className="py-2 px-2 font-medium">Generated</th>
              <th className="py-2 px-2 font-medium w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reports.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400 text-[13px]">
                  No reports yet.
                </td>
              </tr>
            ) : (
              reports.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="py-2 px-2 text-slate-800">{r.name}</td>
                  <td className="py-2 px-2 text-slate-500">
                    {r.dateFrom} → {r.dateTo}
                  </td>
                  <td className="py-2 px-2">
                    <span className="text-[13px] px-2 py-1 rounded-sm bg-slate-100 border border-slate-200 text-slate-700">
                      {r.format}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-slate-400">
                    {r.generatedAt ? relativeTime(r.generatedAt) : 'Pending'}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {r.fileUrl && (
                      <a
                        href={r.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-blue-950 hover:underline text-[13px]"
                      >
                        <Download className="w-3 h-3" /> Download
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderTeamView = () => (
    <div className="space-y-2">
      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="px-2 py-2 border-b border-slate-200 bg-slate-50">
          <p className="text-[13px] font-medium text-slate-700">Team · {team.length}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-2 px-2 font-medium">Name</th>
                <th className="py-2 px-2 font-medium">Email</th>
                <th className="py-2 px-2 font-medium">Role</th>
                <th className="py-2 px-2 font-medium">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {team.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 text-[13px]">
                    No team members yet.
                  </td>
                </tr>
              ) : (
                team.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2 text-slate-800">{m.fullName}</td>
                    <td className="py-2 px-2 text-slate-500">{m.email}</td>
                    <td className="py-2 px-2">
                      <span className="text-[13px] px-2 py-1 rounded-sm bg-blue-50 text-blue-950 border border-blue-100 font-medium">
                        {m.role}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`text-[13px] px-2 py-1 rounded-sm border font-medium ${
                        m.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {m.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="px-2 py-2 border-b border-slate-200 bg-slate-50">
          <p className="text-[13px] font-medium text-slate-700">Audit log · {auditLog.length}</p>
        </div>
        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {auditLog.length === 0 ? (
            <p className="text-[13px] text-slate-400 p-8 text-center">No activity yet.</p>
          ) : (
            auditLog.map((a) => (
              <div key={a.id} className="p-2 text-[13px]">
                <p className="text-slate-800">
                  <span className="font-medium">{a.actorName || 'System'}</span> — {a.action}
                  {a.targetType && (
                    <span className="text-slate-500">
                      {' '}on {a.targetType}#{a.targetId}
                    </span>
                  )}
                </p>
                <p className="text-slate-400 text-[13px]">{relativeTime(a.createdAt)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderSettingsView = () => (
    <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2 text-[13px]">
      <p className="text-[13px] font-semibold text-slate-900 inline-flex items-center gap-2">
        <SettingsIcon className="w-3.5 h-3.5 text-blue-950" />
        Settings
      </p>
      <p className="text-slate-500">
        Brand profile, timezone, default posting windows, and notification preferences.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="border border-slate-100 rounded-sm p-2 space-y-2">
          <p className="font-medium text-slate-700">Brand</p>
          <p className="text-slate-500">SokoFlow Official</p>
        </div>
        <div className="border border-slate-100 rounded-sm p-2 space-y-2">
          <p className="font-medium text-slate-700">Timezone</p>
          <p className="text-slate-500">Africa/Nairobi</p>
        </div>
        <div className="border border-slate-100 rounded-sm p-2 space-y-2">
          <p className="font-medium text-slate-700">Default platforms</p>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <span key={p} className={`inline-flex items-center gap-2 px-2 py-1 rounded-sm font-medium border text-[13px] ${platformBadge(p)}`}>
                <PlatformIcon platform={p} className="w-3 h-3" />
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="border border-slate-100 rounded-sm p-2 space-y-2">
          <p className="font-medium text-slate-700">Notifications</p>
          <p className="text-slate-500">Enabled — via the bell icon above.</p>
        </div>
      </div>
    </div>
  );

  const renderLinksView = () => (
    <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
      <div className="px-2 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <p className="text-[13px] font-medium text-slate-700">Links · {links.length}</p>
        <button
          onClick={() => void loadLinks()}
          className="p-2 rounded-sm hover:bg-slate-100 text-slate-500"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="divide-y divide-slate-100">
        {links.length === 0 ? (
          <p className="text-[13px] text-slate-400 p-8 text-center">No links yet.</p>
        ) : (
          links.map((l) => (
            <div key={l.id} className="p-2 text-[13px] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-slate-800">/{l.shortCode}</p>
                <p className="text-slate-500 truncate">{l.destination}</p>
              </div>
              <span className="text-slate-600 font-mono shrink-0">{l.clicks} clicks</span>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderPlaceholder = (view: ViewKey) => {
    const meta = VIEW_META[view];
    if (!meta) return null;
    const Icon = meta.icon;
    return (
      <div className="bg-white border border-slate-200 rounded-sm p-8 text-center">
        <div className="w-12 h-12 rounded-sm bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-2">
          <Icon className="w-5 h-5 text-blue-950" />
        </div>
        <p className="text-[15px] font-semibold text-slate-900">{meta.title}</p>
        <p className="text-[13px] text-slate-500 mt-2 max-w-md mx-auto">{meta.description}</p>
        <p className="text-[13px] text-slate-400 mt-2">Module scaffolded — wiring up mock data next.</p>
      </div>
    );
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'overview':   return renderOverviewView();
      case 'scheduled':  return renderScheduledView();
      case 'calendar':   return renderCalendarView();
      case 'queue':      return renderQueueView();
      case 'drafts':     return renderDraftsView();
      case 'inbox':      return renderInboxView();
      case 'comments':   return renderInboxView('COMMENT');
      case 'mentions':   return renderInboxView('MENTION');
      case 'published':  return renderPublishedView();
      case 'analytics':  return renderAnalyticsView();
      case 'media':      return renderMediaView();
      case 'templates':  return renderTemplatesView();
      case 'reports':    return renderReportsView();
      case 'accounts':   return renderAccountsSection();
      case 'team':       return renderTeamView();
      case 'settings':   return renderSettingsView();
      default:           return renderPlaceholder(activeView);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {toast && (
        <div
          className={`fixed bottom-2 right-2 z-[120] text-white px-2 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px] ${
            toast.kind === 'success'
              ? 'bg-blue-950'
              : toast.kind === 'error'
                ? 'bg-red-700'
                : 'bg-slate-700'
          }`}
        >
          {toast.kind === 'success' && (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          {toast.kind === 'error' && (
            <XCircle className="w-3.5 h-3.5 text-red-200 shrink-0" />
          )}
          {toast.kind === 'info' && (
            <AlertCircle className="w-3.5 h-3.5 text-blue-200 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="text-slate-300 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-2 py-2 flex items-center justify-between gap-2">
          <div ref={navRef} className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[13px] font-semibold text-slate-900 hidden md:inline">
                Razestore Social
              </span>
            </div>

            <nav className="flex items-center gap-2">
              {NAV_MENUS.map((menu) => {
                const isOpen = openMenu === menu.label;
                const hasActive =
                  activeMenuLabel === menu.label &&
                  menu.items.some((i) => i.key === activeView);
                return (
                  <div key={menu.label} className="relative">
                    <button
                      onClick={() => setOpenMenu(isOpen ? null : menu.label)}
                      className={`inline-flex items-center gap-2 px-2 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${
                        hasActive
                          ? 'bg-blue-950 text-white'
                          : isOpen
                            ? 'bg-slate-100 text-slate-900'
                            : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {menu.label}
                      <ChevronDown
                        className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {isOpen && (
                      <div
                        className="absolute left-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-sm shadow-xl z-[100] py-2"
                        role="menu"
                      >
                        {menu.items.map((item) => {
                          const Icon = item.icon;
                          const isItemActive = item.key === activeView;
                          return (
                            <button
                              key={item.key}
                              onClick={() => handleNavClick(item.key)}
                              role="menuitem"
                              className={`w-full text-left px-2 py-2 text-[13px] flex items-center gap-2 hover:bg-slate-50 ${
                                isItemActive
                                  ? 'text-blue-950 font-medium bg-blue-50/40'
                                  : 'text-slate-700'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                void loadNotifications();
                notify('Notifications refreshed', 'info');
              }}
              aria-label="Notifications"
              className="relative p-2 rounded-sm hover:bg-slate-100 text-slate-500"
            >
              <Bell className="w-4 h-4" />
              {notifications.filter((n) => !n.isRead).length > 0 && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-sm bg-red-500" />
              )}
            </button>
            <button
              onClick={openComposer}
              className="inline-flex items-center gap-2 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2 py-2 rounded-sm text-[13px] transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Create post</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1700px] mx-auto px-2 py-2 space-y-2">
        {renderActiveView()}
      </main>

      {composerOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2"
          onClick={closeComposer}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-5xl w-full max-h-[92vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 py-2 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
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

            <div className="flex-1 overflow-y-auto p-2 grid grid-cols-1 lg:grid-cols-2 gap-2">
              <div className="space-y-2 text-[13px]">
                <form id="composer-form" onSubmit={publishOrSchedule} className="space-y-2">
                  <div>
                    <label className="block font-medium text-slate-700 mb-2 inline-flex items-center gap-2">
                      <ImageIcon className="w-3 h-3" />
                      Media (images &amp; videos)
                    </label>
                    <MediaUploader
                      media={composerMedia}
                      setMedia={setComposerMedia}
                      onToast={notify}
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-2 inline-flex items-center gap-2">
                      <MessageSquare className="w-3 h-3" />
                      Caption
                    </label>
                    <textarea
                      rows={5}
                      required
                      placeholder="Write engaging caption with hashtags..."
                      value={composerCaption}
                      onChange={(e) => setComposerCaption(e.target.value)}
                      className={`w-full bg-white border rounded-sm px-2 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 ${
                        captionOverLimit
                          ? 'border-red-300 focus:ring-red-500'
                          : 'border-slate-200 focus:ring-blue-950'
                      }`}
                    />
                    <p
                      className={`text-[13px] mt-2 ${
                        captionOverLimit ? 'text-red-600 font-medium' : 'text-slate-400'
                      }`}
                    >
                      {composerCaption.length} characters
                      {tightestCaptionLimit !== null &&
                        ` · limit ${tightestCaptionLimit.toLocaleString()}`}
                      {captionOverLimit &&
                        ` · ${composerCaption.length - (tightestCaptionLimit ?? 0)} over`}
                    </p>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-2 inline-flex items-center gap-2">
                      <MessageSquare className="w-3 h-3" />
                      First comment (optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Auto-posted as the first comment on IG/FB/YouTube..."
                      value={composerFirstComment}
                      onChange={(e) => setComposerFirstComment(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-sm px-2 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-2 inline-flex items-center gap-2">
                      <Share2 className="w-3 h-3" />
                      Channels
                    </label>
                    <div className="flex flex-wrap gap-2">
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
                                isSelected ? prev.filter((p) => p !== plat) : [...prev, plat],
                              )
                            }
                            className={`inline-flex items-center gap-2 px-2 py-2 rounded-sm font-medium text-[13px] transition border ${
                              isSelected
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

                    {composerPlatforms.length > 0 && (
                      <ul className="mt-2 space-y-2">
                        {composerPlatforms
                          .filter((p) => PLATFORM_CONFIG[p].hint)
                          .map((p) => (
                            <li
                              key={p}
                              className="text-[13px] text-slate-500 inline-flex items-center gap-2"
                            >
                              <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                              <span>
                                <span className="font-medium text-slate-700">{p}:</span>{' '}
                                {PLATFORM_CONFIG[p].hint}
                              </span>
                            </li>
                          ))}
                      </ul>
                    )}

                    {videoRequiredPlatforms.length > 0 && (
                      <div className="mt-2 bg-amber-50 border border-amber-200 rounded-sm p-2 flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                        <p className="text-[13px] text-amber-900">
                          <span className="font-medium">
                            {videoRequiredPlatforms.join(' and ')}
                          </span>{' '}
                          {videoRequiredPlatforms.length === 1 ? 'requires' : 'require'} a
                          video. Attach one below or uncheck{' '}
                          {videoRequiredPlatforms.length === 1 ? 'it' : 'them'}.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-slate-700 mb-2 inline-flex items-center gap-2">
                        <ShoppingBag className="w-3 h-3" />
                        Product tag
                      </label>
                      <select
                        value={composerProductTag}
                        onChange={(e) => setComposerProductTag(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-sm px-2 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                      >
                        <option value="">No product tag</option>
                        {AVAILABLE_PRODUCTS.map((prod) => (
                          <option key={prod} value={prod}>
                            {prod}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-2 inline-flex items-center gap-2">
                        <Sparkles className="w-3 h-3" />
                        Campaign
                      </label>
                      <input
                        type="text"
                        value={composerCampaign}
                        onChange={(e) => setComposerCampaign(e.target.value)}
                        placeholder="e.g. Q4 Launch"
                        className="w-full bg-white border border-slate-200 rounded-sm px-2 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <p className="text-[13px] font-medium text-slate-700 inline-flex items-center gap-2">
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
                        min={toLocalDatetimeInputValue(new Date(Date.now() + 60_000))}
                        onChange={(e) => setComposerScheduleTime(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-sm px-2 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                      />
                    )}
                  </div>
                </form>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-slate-900 inline-flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-blue-950" />
                    Live preview
                  </p>
                  <span className="text-[13px] bg-blue-50 text-blue-950 border border-blue-100 font-medium px-2 py-1 rounded-sm">
                    {composerPlatforms.length} channel
                    {composerPlatforms.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {composerPlatforms.length === 0 ? (
                  <div className="py-8 text-center text-[13px] text-slate-400 border border-dashed border-slate-300 rounded-sm">
                    Select at least one connected platform to view preview.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                    {composerPlatforms.map((plat) => (
                      <div
                        key={plat}
                        className="border border-slate-200 rounded-sm p-2 space-y-2 bg-slate-50"
                      >
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="font-medium text-slate-800 inline-flex items-center gap-2">
                            <PlatformIcon platform={plat} className="w-3.5 h-3.5 text-blue-950" />
                            {plat} preview
                          </span>
                          <span className="text-slate-400">
                            {PLATFORM_CONFIG[plat].videoOnly ? 'Video' : 'Feed'}
                          </span>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-sm bg-blue-950 text-white font-medium flex items-center justify-center text-[13px]">
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
                            {composerCaption || 'Your caption will appear here as you type...'}
                          </p>

                          {composerMedia.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 rounded-sm overflow-hidden border border-slate-200">
                              {composerMedia.slice(0, 4).map((m, i) => {
                                const isOverflowCell = i === 3 && composerMedia.length > 4;
                                return (
                                  <div key={m.id} className="relative aspect-square">
                                    {m.type === 'video' ? (
                                      <video
                                        src={m.url}
                                        muted
                                        playsInline
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <img
                                        src={m.url}
                                        alt=""
                                        className="w-full h-full object-cover"
                                      />
                                    )}
                                    {isOverflowCell && (
                                      <div className="absolute inset-0 bg-slate-900/70 text-white flex items-center justify-center text-[13px] font-medium">
                                        +{composerMedia.length - 4} more
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {composerProductTag && (
                            <div className="bg-blue-50 border border-blue-100 rounded-sm p-2 flex items-center gap-2 text-[13px] text-blue-950 font-medium">
                              <ShoppingBag className="w-3.5 h-3.5 text-blue-950" />
                              Shop: {composerProductTag}
                            </div>
                          )}

                          {composerFirstComment && (
                            <div className="bg-slate-50 border border-slate-100 rounded-sm p-2 text-[13px] text-slate-600">
                              <span className="font-medium text-slate-700">First comment:</span>{' '}
                              {composerFirstComment}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-2 py-2 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
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
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2 py-2 rounded-sm text-[13px] disabled:opacity-50"
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
                    composerMedia.some((m) => m.uploading || m.error) ||
                    videoRequiredPlatforms.length > 0 ||
                    captionOverLimit
                  }
                  className="inline-flex items-center gap-2 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2 py-2 rounded-sm text-[13px] disabled:opacity-50"
                >
                  {composerSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  {composerSubmitting
                    ? 'Submitting...'
                    : isScheduling
                      ? 'Schedule post'
                      : 'Publish now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {disconnectTarget && (
        <div
          className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2"
          onClick={() => !disconnectInFlight && setDisconnectTarget(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-2 shadow-xl text-center space-y-2 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-sm bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">
                Disconnect {disconnectTarget.name}?
              </h3>
              <p className="text-slate-500 mt-2">
                Scheduled posts to{' '}
                <span className="font-mono text-slate-800">{disconnectTarget.handle}</span> will
                fail until reconnected.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
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
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-sm text-[13px] disabled:opacity-50 inline-flex items-center justify-center gap-2"
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

function MediaUploader({
  media,
  setMedia,
  onToast,
}: {
  media: MediaItem[];
  setMedia: React.Dispatch<React.SetStateAction<MediaItem[]>>;
  onToast: (msg: string, kind?: 'success' | 'error' | 'info') => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;

    const remainingSlots = MAX_MEDIA_FILES - media.length;
    if (remainingSlots <= 0) {
      onToast(`Max ${MAX_MEDIA_FILES} files per post`, 'error');
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
      if (rejected > 0) {
        onToast(
          `File not supported or too large (max ${MAX_FILE_SIZE_MB}MB)`,
          'error',
        );
      }
      return;
    }

    setMedia((prev) => [...prev, ...accepted.map((a) => a.item)]);
    onToast(
      `Uploading ${accepted.length} file${accepted.length > 1 ? 's' : ''}...${
        rejected ? ` · ${rejected} rejected` : ''
      }`,
      'info',
    );

    await Promise.all(
      accepted.map(async ({ item, file }) => {
        try {
          const result = await adminApi.social.media.upload(file);
          setMedia((prev) =>
            prev.map((m) =>
              m.id === item.id
                ? { ...m, serverId: result.id, uploading: false, progress: 100 }
                : m,
            ),
          );
        } catch (err: any) {
          setMedia((prev) =>
            prev.map((m) =>
              m.id === item.id
                ? { ...m, uploading: false, error: err?.message ?? 'Upload failed' }
                : m,
            ),
          );
          onToast(`Failed to upload ${file.name}`, 'error');
        }
      }),
    );
  };

  const removeFile = (id: string) => {
    setMedia((prev) => {
      const target = prev.find((m) => m.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((m) => m.id !== id);
    });
    onToast('File removed', 'info');
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
        className={`w-full border-2 border-dashed rounded-sm px-2 py-2 text-center cursor-pointer transition ${
          isDragging
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
        <p className="text-[13px] text-slate-700 font-medium mt-2">
          {isDragging ? 'Drop files here' : 'Drag & drop or click to upload'}
        </p>
        <p className="text-[13px] text-slate-500 mt-2">
          Images &amp; videos · max {MAX_FILE_SIZE_MB}MB · up to {MAX_MEDIA_FILES} files
          {media.length > 0 && ` · ${media.length}/${MAX_MEDIA_FILES} used`}
        </p>
      </div>

      {media.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {media.map((m) => (
            <div
              key={m.id}
              className={`relative aspect-square rounded-sm overflow-hidden border bg-slate-100 group ${
                m.error ? 'border-red-300' : 'border-slate-200'
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
                    <span className="w-8 h-8 rounded-sm bg-white/90 flex items-center justify-center shadow">
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
                  <p className="text-[13px] text-center py-1">Uploading...</p>
                </div>
              )}

              {m.error && (
                <div className="absolute inset-x-0 bottom-0 bg-red-600 text-white">
                  <p className="text-[13px] text-center py-1">Failed</p>
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

              <span className="absolute bottom-1 left-1 bg-slate-900/70 text-white text-[13px] px-2 py-1 rounded-sm">
                {formatBytes(m.size)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}