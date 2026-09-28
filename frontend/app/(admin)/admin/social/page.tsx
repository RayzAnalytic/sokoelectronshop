'use client';

import React, { useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import {
  FaFacebookF,
  FaInstagram,
  FaTiktok,
  FaYoutube,
  FaXTwitter,
  FaWhatsapp,
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

// --- TYPES ---
type SocialTab = 'Scheduled' | 'Published' | 'Analytics';
type SocialPlatform = 'Facebook' | 'Instagram' | 'TikTok' | 'YouTube' | 'X' | 'WhatsApp';
type MediaType = 'image' | 'video';

interface ConnectedAccount {
  id: SocialPlatform;
  name: string;
  handle: string;
  connected: boolean;
  avatarBg: string;
}

interface MediaItem {
  id: string;
  url: string;
  type: MediaType;
  name: string;
  size: number;
  uploading?: boolean;
  progress?: number;
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

const INITIAL_ACCOUNTS: ConnectedAccount[] = [
  { id: 'Facebook', name: 'Facebook Page', handle: '@SokoFlowOfficial', connected: true, avatarBg: 'bg-[#1877F2]' },
  { id: 'Instagram', name: 'Instagram Business', handle: '@sokoflow.ke', connected: true, avatarBg: 'bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF]' },
  { id: 'TikTok', name: 'TikTok Creator', handle: '@sokoflow_store', connected: true, avatarBg: 'bg-black' },
  { id: 'YouTube', name: 'YouTube Channel', handle: '@SokoFlowKE', connected: false, avatarBg: 'bg-[#FF0000]' },
  { id: 'X', name: 'X (Twitter)', handle: '@SokoFlowHQ', connected: false, avatarBg: 'bg-black' },
  { id: 'WhatsApp', name: 'WhatsApp Business', handle: '+254 712 345 678', connected: true, avatarBg: 'bg-[#25D366]' },
];

const INITIAL_SCHEDULED: ScheduledPost[] = [
  {
    id: 'sch-1',
    platforms: ['Facebook', 'Instagram'],
    caption: '🚀 Boost your small business with SokoFlow! Automate your WhatsApp orders and M-Pesa payments instantly.',
    scheduledTime: 'Tomorrow, 10:00 AM',
    productTag: 'SokoFlow Pro Subscription',
  },
  {
    id: 'sch-2',
    platforms: ['TikTok'],
    caption: 'Watch how fast you can checkout using our automated WhatsApp cart! 🛒📱 #ecommerce #nairobi',
    scheduledTime: 'Sep 26, 2:30 PM',
    mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=60',
  },
  {
    id: 'sch-3',
    platforms: ['WhatsApp'],
    caption: 'Hi {{customer_name}}, your weekly VIP deals are here. Reply SHOP to browse 👇',
    scheduledTime: 'Tomorrow, 9:00 AM',
    productTag: 'VIP Weekly Deals',
  },
];

const INITIAL_PUBLISHED: PublishedPost[] = [
  { id: 'pub-1', platform: 'Instagram', caption: 'New stock alert! Premium wireless mechanical keyboards now available in Nairobi. ⌨️✨', publishedAt: '2 days ago', likes: 342, comments: 28, shares: 14, reach: 5200 },
  { id: 'pub-2', platform: 'Facebook', caption: 'How to integrate M-Pesa STK push into your Django web app in 5 simple steps.', publishedAt: '4 days ago', likes: 189, comments: 45, shares: 32, reach: 4100 },
  { id: 'pub-3', platform: 'TikTok', caption: 'Unboxing the UltraWide 29" Gaming Monitor! 🖥️🔥', publishedAt: '5 days ago', likes: 1250, comments: 94, shares: 180, reach: 18900 },
  { id: 'pub-4', platform: 'YouTube', caption: 'Full walkthrough: Setting up SokoFlow with WhatsApp Business API and M-Pesa Daraja sandbox.', publishedAt: '6 days ago', likes: 412, comments: 67, shares: 41, reach: 8400 },
  { id: 'pub-5', platform: 'X', caption: 'We are live at Dedan Kimathi Tech Week! Come check out our conversational commerce dashboard.', publishedAt: '1 week ago', likes: 95, comments: 12, shares: 24, reach: 2300 },
  { id: 'pub-6', platform: 'WhatsApp', caption: 'Broadcast: October VIP early access preview — reply yes to unlock.', publishedAt: '3 days ago', likes: 0, comments: 84, shares: 0, reach: 1240 },
];

const ANALYTICS_FOLLOWER_DATA = [
  { month: 'May', Facebook: 2100, Instagram: 3400, TikTok: 1200, YouTube: 600, X: 900, WhatsApp: 800 },
  { month: 'Jun', Facebook: 2400, Instagram: 4100, TikTok: 2100, YouTube: 1100, X: 1100, WhatsApp: 1200 },
  { month: 'Jul', Facebook: 2800, Instagram: 5200, TikTok: 3800, YouTube: 1900, X: 1400, WhatsApp: 1700 },
  { month: 'Aug', Facebook: 3200, Instagram: 6700, TikTok: 5900, YouTube: 2900, X: 1700, WhatsApp: 2200 },
  { month: 'Sep', Facebook: 3900, Instagram: 8500, TikTok: 9400, YouTube: 4200, X: 2200, WhatsApp: 3100 },
];

const PLATFORM_ENGAGEMENT_COMPARISON = [
  { platform: 'Instagram', Reach: 8500, Engagement: 3400 },
  { platform: 'TikTok', Reach: 14200, Engagement: 5100 },
  { platform: 'Facebook', Reach: 4800, Engagement: 1600 },
  { platform: 'YouTube', Reach: 9100, Engagement: 2800 },
  { platform: 'WhatsApp', Reach: 3100, Engagement: 2050 },
  { platform: 'X', Reach: 2900, Engagement: 850 },
];

const AVAILABLE_PRODUCTS = [
  'SokoFlow Pro Subscription',
  'Smart Home Wi-Fi Router AX3000',
  'Wireless Ergonomic Mechanical Keyboard',
  'UltraWide 29" Gaming Monitor',
  'USB-C Multiport Hub 7-in-1',
];

const PLATFORMS: SocialPlatform[] = ['Facebook', 'Instagram', 'TikTok', 'YouTube', 'X', 'WhatsApp'];
const TABS: SocialTab[] = ['Scheduled', 'Published', 'Analytics'];

const MAX_MEDIA_FILES = 5;
const MAX_FILE_SIZE_MB = 25;

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    case 'WhatsApp':
      return <FaWhatsapp className={className} />;
  }
};

export default function SocialMediaPage() {
  const [activeTab, setActiveTab] = useState<SocialTab>('Scheduled');
  const [accounts, setAccounts] = useState<ConnectedAccount[]>(INITIAL_ACCOUNTS);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>(INITIAL_SCHEDULED);
  const [publishedPosts, setPublishedPosts] = useState<PublishedPost[]>(INITIAL_PUBLISHED);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<ConnectedAccount | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [composerCaption, setComposerCaption] = useState('');
  const [composerPlatforms, setComposerPlatforms] = useState<SocialPlatform[]>(['Instagram', 'Facebook']);
  const [composerProductTag, setComposerProductTag] = useState('');
  const [composerScheduleTime, setComposerScheduleTime] = useState('');
  const [composerMedia, setComposerMedia] = useState<MediaItem[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
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

  const toast = (msg: string) => setToastMessage(msg);

  const openComposer = () => {
    setComposerCaption('');
    setComposerPlatforms(accounts.filter((a) => a.connected).map((a) => a.id).slice(0, 2));
    setComposerProductTag('');
    setComposerScheduleTime('');
    setIsScheduling(false);
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
  };

  const togglePlatformConnect = (account: ConnectedAccount) => {
    if (account.connected) {
      setDisconnectTarget(account);
    } else {
      setAccounts((prev) => prev.map((a) => (a.id === account.id ? { ...a, connected: true } : a)));
      toast(`Connected to ${account.name}`);
    }
  };

  const confirmDisconnect = () => {
    if (!disconnectTarget) return;
    setAccounts((prev) =>
      prev.map((a) => (a.id === disconnectTarget.id ? { ...a, connected: false } : a))
    );
    setComposerPlatforms((prev) => prev.filter((p) => p !== disconnectTarget.id));
    toast(`Disconnected from ${disconnectTarget.name}`);
    setDisconnectTarget(null);
  };

  const publishOrSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerCaption.trim() || composerPlatforms.length === 0) return;

    if (isScheduling && composerScheduleTime) {
      const newSch: ScheduledPost = {
        id: `sch-${Date.now()}`,
        platforms: composerPlatforms,
        caption: composerCaption,
        scheduledTime: composerScheduleTime,
        productTag: composerProductTag || undefined,
        mediaUrl: composerMedia[0]?.url,
      };
      setScheduledPosts([newSch, ...scheduledPosts]);
      toast('Post scheduled');
      setActiveTab('Scheduled');
    } else {
      composerPlatforms.forEach((plat) => {
        const newPub: PublishedPost = {
          id: `pub-${Date.now()}-${plat}`,
          platform: plat,
          caption: composerCaption,
          publishedAt: 'Just now',
          likes: Math.floor(Math.random() * 50) + 10,
          comments: Math.floor(Math.random() * 10) + 2,
          shares: Math.floor(Math.random() * 5) + 1,
          reach: Math.floor(Math.random() * 500) + 100,
        };
        setPublishedPosts((prev) => [newPub, ...prev]);
      });
      toast(`Published to ${composerPlatforms.join(', ')}`);
      setActiveTab('Published');
    }

    closeComposer();
  };

  const deleteScheduled = (id: string) => {
    setScheduledPosts((prev) => prev.filter((p) => p.id !== id));
    toast('Scheduled post deleted');
  };

  const postNowFromScheduled = (post: ScheduledPost) => {
    deleteScheduled(post.id);
    post.platforms.forEach((plat) => {
      setPublishedPosts((prev) => [
        {
          id: `pub-${Date.now()}-${plat}`,
          platform: plat,
          caption: post.caption,
          publishedAt: 'Just now',
          likes: 12,
          comments: 2,
          shares: 1,
          reach: 150,
        },
        ...prev,
      ]);
    });
    toast('Published immediately');
    setActiveTab('Published');
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
            : p === 'WhatsApp'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
              : 'bg-slate-100 text-slate-800 border-slate-200';

  const connectedAccounts = accounts.filter((a) => a.connected);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[120] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
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
            <span className="text-[13px] text-slate-500">
              {connectedAccounts.length} of {accounts.length} connected
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className={`bg-white border rounded-sm p-2 flex items-center justify-between gap-2 ${acc.connected ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-slate-200'
                  }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-9 h-9 rounded-sm ${acc.avatarBg} text-white font-semibold text-[13px] flex items-center justify-center shrink-0`}
                  >
                    <PlatformIcon platform={acc.id} className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-900 truncate">{acc.name}</p>
                    <p className="text-[13px] text-slate-500 font-mono truncate">{acc.handle}</p>
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
                  onClick={() => togglePlatformConnect(acc)}
                  className={`px-2.5 py-2 rounded-sm font-medium text-[13px] transition shrink-0 border ${acc.connected
                      ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      : 'bg-blue-950 border-blue-950 text-white hover:bg-blue-900'
                    }`}
                >
                  {acc.connected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            ))}
          </div>
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
              <button
                onClick={openComposer}
                className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                New post
              </button>
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
                  {scheduledPosts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 text-[13px]">
                        No scheduled posts yet. Click <span className="font-medium text-slate-600">Create post</span> to add one.
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
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border text-[13px] ${platformBadge(
                                  p
                                )}`}
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
                              onClick={() => postNowFromScheduled(post)}
                              className="px-2.5 py-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-[13px]"
                            >
                              Post now
                            </button>
                            <button
                              onClick={() => deleteScheduled(post.id)}
                              className="p-2 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 transition"
                              title="Delete"
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
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={PLATFORM_ENGAGEMENT_COMPARISON}>
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
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                <p className="text-[13px] font-medium text-slate-700">
                  Published posts & analytics · {publishedPosts.length}
                </p>
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
                    {publishedPosts.map((pub) => (
                      <tr key={pub.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border text-[13px] ${platformBadge(
                              pub.platform
                            )}`}
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
                    ))}
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
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ANALYTICS_FOLLOWER_DATA}>
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
                    <Line type="monotone" dataKey="WhatsApp" stroke="#25D366" strokeWidth={2} />
                    <Line type="monotone" dataKey="X" stroke="#0ea5e9" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
              <p className="text-[13px] font-semibold text-slate-900 inline-flex items-center gap-1.5">
                <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                Engagement by platform
              </p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={PLATFORM_ENGAGEMENT_COMPARISON}>
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
                      Media (images & videos)
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
                        type="text"
                        placeholder="e.g. Tomorrow at 10:00 AM"
                        value={composerScheduleTime}
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
                            {plat === 'YouTube'
                              ? 'Video'
                              : plat === 'WhatsApp'
                                ? 'Broadcast'
                                : 'Feed'}
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
                {composerMedia.length > 0 ? `${composerMedia.length} media file(s) attached` : 'No media attached'}
                {composerPlatforms.length > 0 ? ` · ${composerPlatforms.length} channel(s)` : ''}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeComposer}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="composer-form"
                  disabled={!composerCaption.trim() || composerPlatforms.length === 0}
                  className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isScheduling ? 'Schedule post' : 'Publish now'}
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
          onClick={() => setDisconnectTarget(null)}
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
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={confirmDisconnect}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-sm text-[13px]"
              >
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
   Media uploader
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

  const addFiles = (files: FileList | null) => {
    if (!files) return;

    const remainingSlots = MAX_MEDIA_FILES - media.length;
    if (remainingSlots <= 0) {
      onToast(`Max ${MAX_MEDIA_FILES} files per post`);
      return;
    }

    const incoming = Array.from(files).slice(0, remainingSlots);
    const accepted: MediaItem[] = [];
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
        id,
        url,
        type: isVideo ? 'video' : 'image',
        name: file.name,
        size: file.size,
        uploading: true,
        progress: 0,
      });
    });

    if (accepted.length > 0) {
      setMedia((prev) => [...prev, ...accepted]);
      onToast(
        `${accepted.length} file${accepted.length > 1 ? 's' : ''} added${rejected ? ` · ${rejected} rejected` : ''
        }`
      );

      accepted.forEach((item) => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 25 + 10;
          if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setMedia((prev) =>
              prev.map((m) => (m.id === item.id ? { ...m, uploading: false, progress: 100 } : m))
            );
          } else {
            setMedia((prev) =>
              prev.map((m) => (m.id === item.id ? { ...m, progress } : m))
            );
          }
        }, 180);
      });
    } else if (rejected > 0) {
      onToast(`File not supported or too large (max ${MAX_FILE_SIZE_MB}MB)`);
    }
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
    addFiles(e.dataTransfer.files);
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
            addFiles(e.target.files);
            if (fileRef.current) fileRef.current.value = '';
          }}
        />
        <ImageIcon className="w-5 h-5 mx-auto text-slate-400" />
        <p className="text-[13px] text-slate-700 font-medium mt-1">
          {isDragging ? 'Drop files here' : 'Drag & drop or click to upload'}
        </p>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Images & videos · max {MAX_FILE_SIZE_MB}MB · up to {MAX_MEDIA_FILES} files
          {media.length > 0 && ` · ${media.length}/${MAX_MEDIA_FILES} used`}
        </p>
      </div>

      {media.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {media.map((m) => (
            <div
              key={m.id}
              className="relative aspect-square rounded-sm overflow-hidden border border-slate-200 bg-slate-100 group"
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
                    {Math.round(m.progress ?? 0)}%
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(m.id);
                }}
                className="absolute top-1 right-1 h-5 w-5 rounded-sm bg-white/90 hover:bg-white text-red-600 flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove"
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