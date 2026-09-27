'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  CheckCircle2,
  X,
  Send,
  Download,
  Users,
  TrendingUp,
  UserPlus,
  UserX,
  Percent,
  Search,
  Trash2,
  Eye,
  ChevronDown,
  Check,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

// --- TYPES ---
type SubscriberStatus = 'Subscribed' | 'Unsubscribed';
type SubscriberSource = 'Footer Popup' | 'Checkout' | 'WhatsApp Opt-in' | 'Manual Import';

interface Subscriber {
  id: string;
  email: string;
  name: string;
  source: SubscriberSource;
  status: SubscriberStatus;
  joinedDate: string;
}

const INITIAL_SUBSCRIBERS: Subscriber[] = [
  { id: 'sub-1', email: 'brian.kiprop@strathmore.edu', name: 'Brian Kiprop', source: 'Footer Popup', status: 'Subscribed', joinedDate: 'Sep 22, 2026' },
  { id: 'sub-2', email: 'amina.mohamed@gmail.com', name: 'Amina Mohamed', source: 'Checkout', status: 'Subscribed', joinedDate: 'Sep 21, 2026' },
  { id: 'sub-3', email: 'kevin.ochieng@outlook.com', name: 'Kevin Ochieng', source: 'WhatsApp Opt-in', status: 'Subscribed', joinedDate: 'Sep 20, 2026' },
  { id: 'sub-4', email: 'sharon.wangari@yahoo.com', name: 'Sharon Wangari', source: 'Footer Popup', status: 'Unsubscribed', joinedDate: 'Sep 14, 2026' },
  { id: 'sub-5', email: 'dev.isaacmutinda@gmail.com', name: 'Isaac Mutinda', source: 'Manual Import', status: 'Subscribed', joinedDate: 'Sep 10, 2026' },
  { id: 'sub-6', email: 'wanjiku.mwangi@startup.co.ke', name: 'Wanjiku Mwangi', source: 'Checkout', status: 'Subscribed', joinedDate: 'Sep 05, 2026' },
];

const GROWTH_CHART_DATA = [
  { month: 'Apr', subscribers: 1200 },
  { month: 'May', subscribers: 1950 },
  { month: 'Jun', subscribers: 2800 },
  { month: 'Jul', subscribers: 3900 },
  { month: 'Aug', subscribers: 5400 },
  { month: 'Sep', subscribers: 7820 },
];

const SOURCES: SubscriberSource[] = ['Footer Popup', 'Checkout', 'WhatsApp Opt-in', 'Manual Import'];
const STATUSES: SubscriberStatus[] = ['Subscribed', 'Unsubscribed'];

export default function NewsletterPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>(INITIAL_SUBSCRIBERS);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubscriberStatus | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SubscriberSource | null>(null);

  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastAudience, setBroadcastAudience] = useState('All Active Subscribers (7,820)');
  const [broadcastSchedule, setBroadcastSchedule] = useState('now');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (!broadcastOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBroadcastOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [broadcastOpen]);

  const toast = (msg: string) => setToastMessage(msg);

  const sendBroadcast = () => {
    setBroadcastOpen(false);
    setBroadcastSubject('');
    setBroadcastBody('');
    setShowPreview(false);
    toast('Broadcast queued for delivery');
  };

  const exportSubscribers = () => {
    const csv =
      'data:text/csv;charset=utf-8,' +
      ['Email,Name,Source,Status,Joined Date', ...subscribers.map((s) => `${s.email},"${s.name}",${s.source},${s.status},${s.joinedDate}`)].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', 'subscribers_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Exported subscribers CSV');
  };

  const removeSubscriber = (id: string) => {
    setSubscribers((prev) => prev.filter((s) => s.id !== id));
    toast('Subscriber removed');
  };

  const filtered = subscribers.filter((sub) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q || sub.email.toLowerCase().includes(q) || sub.name.toLowerCase().includes(q);
    const matchesStatus = !statusFilter || sub.status === statusFilter;
    const matchesSource = !sourceFilter || sub.source === sourceFilter;
    return matchesSearch && matchesStatus && matchesSource;
  });

  const activeFilterCount = (statusFilter ? 1 : 0) + (sourceFilter ? 1 : 0);

  const sourceBadge = (s: SubscriberSource) =>
    s === 'Footer Popup'
      ? 'bg-blue-50 text-blue-950 border-blue-100'
      : s === 'Checkout'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'WhatsApp Opt-in'
      ? 'bg-amber-50 text-amber-700 border-amber-100'
      : 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
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
            <h1 className="text-[15px] font-semibold text-slate-900">Newsletter</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Manage subscriber lists, popup opt-ins, and broadcasts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportSubscribers}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => setBroadcastOpen(true)}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send broadcast</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Total subscribers</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">7,820</p>
              <p className="text-[13px] text-emerald-600 mt-0.5 inline-flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                Active list
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">New this month</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">+1,420</p>
              <p className="text-[13px] text-emerald-600 mt-0.5 inline-flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                +18.4% popups
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <UserPlus className="w-4 h-4" />
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Unsubscribed</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">142</p>
              <p className="text-[13px] text-slate-500 mt-0.5">1.8% churn</p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <UserX className="w-4 h-4" />
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Growth rate</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">+12.4%</p>
              <p className="text-[13px] text-emerald-600 mt-0.5 inline-flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                MoM
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <Percent className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* GROWTH CHART */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-slate-900">
              Subscriber list growth · 6 months
            </p>
            <span className="text-[13px] text-slate-400">Marketing analytics</span>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={GROWTH_CHART_DATA}>
                <defs>
                  <linearGradient id="subColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#172554" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#172554" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={13} />
                <YAxis stroke="#94a3b8" fontSize={13} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontSize: '13px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="subscribers"
                  stroke="#172554"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#subColor)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* FILTERS */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by email or name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              label="Status"
              value={statusFilter}
              options={STATUSES as unknown as string[]}
              onChange={(v) => setStatusFilter(v as SubscriberStatus | null)}
            />
            <FilterDropdown
              label="Source"
              value={sourceFilter}
              options={SOURCES as unknown as string[]}
              onChange={(v) => setSourceFilter(v as SubscriberSource | null)}
            />
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setStatusFilter(null);
                  setSourceFilter(null);
                }}
                className="text-[13px] text-red-600 hover:underline font-medium px-2 py-2"
              >
                Clear ({activeFilterCount})
              </button>
            )}
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <p className="text-[13px] font-medium text-slate-700">
              Subscribers directory · {filtered.length}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2 px-3 font-medium">Email</th>
                  <th className="py-2 px-3 font-medium">Name</th>
                  <th className="py-2 px-3 font-medium">Source</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium">Joined</th>
                  <th className="py-2 px-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-[13px]">
                      No subscribers match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 font-mono text-slate-900 truncate max-w-[260px]">
                        {sub.email}
                      </td>
                      <td className="py-2 px-3 text-slate-700">{sub.name}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${sourceBadge(
                            sub.source
                          )}`}
                        >
                          {sub.source}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${
                            sub.status === 'Subscribed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-red-50 text-red-600 border-red-100'
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-400">{sub.joinedDate}</td>
                      <td className="py-2 px-3">
                        <button
                          onClick={() => removeSubscriber(sub.id)}
                          className="p-1.5 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 transition"
                          title="Remove subscriber"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* BROADCAST MODAL */}
      {broadcastOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setBroadcastOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-3xl w-full max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-slate-900">Send newsletter broadcast</h3>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Compose and dispatch email newsletters to your subscribers
                </p>
              </div>
              <button
                onClick={() => setBroadcastOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Target audience segment
                </label>
                <select
                  value={broadcastAudience}
                  onChange={(e) => setBroadcastAudience(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                >
                  <option value="All Active Subscribers (7,820)">All active subscribers (7,820)</option>
                  <option value="Subscribed via Checkout (3,200)">Subscribed via checkout (3,200)</option>
                  <option value="Subscribed via Footer Popup (4,620)">Subscribed via footer popup (4,620)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Email subject line</label>
                <input
                  type="text"
                  placeholder="e.g. Weekly picks: top electronics & M-Pesa deals"
                  value={broadcastSubject}
                  onChange={(e) => setBroadcastSubject(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-slate-700">Email body</label>
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {showPreview ? 'Edit content' : 'Preview'}
                  </button>
                </div>

                {!showPreview ? (
                  <textarea
                    rows={6}
                    placeholder="Hi {{name}}, welcome to this week's newsletter…"
                    value={broadcastBody}
                    onChange={(e) => setBroadcastBody(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 min-h-[140px]">
                    <p className="text-[15px] font-semibold text-slate-900">
                      {broadcastSubject || 'Untitled subject'}
                    </p>
                    <p className="text-[13px] text-slate-700 whitespace-pre-wrap mt-2">
                      {broadcastBody || 'No content entered yet.'}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Schedule</label>
                <select
                  value={broadcastSchedule}
                  onChange={(e) => setBroadcastSchedule(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                >
                  <option value="now">Send immediately</option>
                  <option value="tomorrow">Tomorrow morning (9 AM EAT)</option>
                  <option value="custom">Custom date & time</option>
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setBroadcastOpen(false)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={sendBroadcast}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                <Send className="w-3.5 h-3.5" />
                Dispatch broadcast
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── FilterDropdown ─────────── */
function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', onDoc);
      document.addEventListener('keydown', onKey);
    }
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isActive = value !== null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 border rounded-sm px-3 py-2 text-[13px] font-medium transition whitespace-nowrap ${
          isActive
            ? 'bg-blue-50 border-blue-950 text-blue-950'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
        }`}
      >
        {value ?? label}
        <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 w-56 rounded-sm border border-slate-200 bg-white shadow-lg z-50 p-1">
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`w-full text-left px-2 py-2 rounded-sm text-[13px] ${
              !isActive ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            All {label.toLowerCase()}
          </button>
          <div className="border-t border-slate-100 my-1" />
          {options.map((opt) => {
            const selected = value === opt;
            return (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-2 py-2 rounded-sm text-[13px] flex items-center justify-between ${
                  selected ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{opt}</span>
                {selected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
