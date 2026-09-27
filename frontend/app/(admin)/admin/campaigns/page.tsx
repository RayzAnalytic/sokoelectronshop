'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Megaphone,
  Plus,
  CheckCircle2,
  X,
  Send,
  TrendingUp,
  Mail,
  MessageSquare,
  Smartphone,
  ArrowRight,
  ArrowLeft,
  Eye,
  Percent,
  Sparkles,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

// --- TYPES ---
type CampaignTab = 'All' | 'Draft' | 'Scheduled' | 'Sending' | 'Completed';
type CampaignChannel = 'Email' | 'SMS' | 'WhatsApp';
type CampaignStatus = 'Draft' | 'Scheduled' | 'Sending' | 'Completed';

interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  audience: string;
  sent: number;
  openRate: string;
  clickRate: string;
  status: CampaignStatus;
  date: string;
}

const INITIAL_CAMPAIGNS: Campaign[] = [
  { id: 'cmp-1', name: 'Weekend Flash Sale - M-Pesa Discount', channel: 'WhatsApp', audience: 'All Active Customers (12,400)', sent: 12400, openRate: '94.2%', clickRate: '28.5%', status: 'Completed', date: 'Yesterday' },
  { id: 'cmp-2', name: 'New Django & Next.js Course Launch', channel: 'Email', audience: 'Developers & Tech Students (4,100)', sent: 4100, openRate: '48.6%', clickRate: '14.2%', status: 'Completed', date: '3 days ago' },
  { id: 'cmp-3', name: 'Dedan Kimathi Tech Week Reminder', channel: 'SMS', audience: 'Nairobi & Nyeri Region (2,800)', sent: 0, openRate: '0%', clickRate: '0%', status: 'Scheduled', date: 'Tomorrow, 9:00 AM' },
  { id: 'cmp-4', name: 'Abandoned Cart Recovery #4', channel: 'WhatsApp', audience: 'Cart Abandoners > 24h (450)', sent: 450, openRate: '88.0%', clickRate: '35.1%', status: 'Sending', date: 'In progress' },
  { id: 'cmp-5', name: 'Q4 Enterprise Software Proposal', channel: 'Email', audience: 'B2B Corporate Clients (320)', sent: 0, openRate: '0%', clickRate: '0%', status: 'Draft', date: 'Unscheduled' },
];

const TEMPLATES = [
  { id: 't1', name: 'M-Pesa Promo Blast', channel: 'WhatsApp', preview: '🚀 Exclusive offer! Get 15% off your next order when you pay with M-Pesa STK push. Tap here to claim: {{checkout_link}}' },
  { id: 't2', name: 'Product Restock Alert', channel: 'Email', preview: 'Hi {{customer_name}}, your favorite mechanical keyboards are back in stock! Order now before they sell out.' },
  { id: 't3', name: 'Quick Feedback Survey', channel: 'SMS', preview: 'Hi {{customer_name}}, how was your experience today? Reply 1 for Excellent, 2 for Needs Improvement.' },
];

const AUDIENCES = [
  'All Active Customers (15,200)',
  'High Spenders > KES 10,000 (3,400)',
  'Cart Abandoners in Last 48 Hours (450)',
  'Nairobi & Mombasa Region (8,900)',
  'Custom Segment Builder Filter',
];

const AUDIENCE_OPTIONS = AUDIENCES.slice(0, 4);

export default function CampaignsPage() {
  const [activeTab, setActiveTab] = useState<CampaignTab>('All');
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);

  const [newCampName, setNewCampName] = useState('');
  const [newCampChannel, setNewCampChannel] = useState<CampaignChannel>('WhatsApp');
  const [newCampAudience, setNewCampAudience] = useState(AUDIENCES[0]);
  const [newCampSubject, setNewCampSubject] = useState('');
  const [newCampBody, setNewCampBody] = useState('');
  const [newCampScheduleType, setNewCampScheduleType] = useState<'now' | 'scheduled'>('now');
  const [newCampABTest, setNewCampABTest] = useState(false);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (!createOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCreateOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [createOpen]);

  const toast = (msg: string) => setToastMessage(msg);

  const submitCampaign = () => {
    const newCampaign: Campaign = {
      id: `cmp-${Date.now()}`,
      name: newCampName || 'Untitled Marketing Campaign',
      channel: newCampChannel,
      audience: newCampAudience,
      sent: newCampScheduleType === 'now' ? 1520 : 0,
      openRate: '0%',
      clickRate: '0%',
      status: newCampScheduleType === 'now' ? 'Sending' : 'Scheduled',
      date: newCampScheduleType === 'now' ? 'Just now' : 'Scheduled for tomorrow',
    };
    setCampaigns([newCampaign, ...campaigns]);
    setCreateOpen(false);
    setWizardStep(1);
    setNewCampName('');
    setNewCampSubject('');
    setNewCampBody('');
    toast('Campaign created');
  };

  const deleteCampaign = (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    toast('Campaign deleted');
  };

  const filtered = campaigns.filter((c) => {
    if (activeTab === 'All') return true;
    return c.status === activeTab;
  });

  const channelBadge = (c: CampaignChannel) =>
    c === 'WhatsApp'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : c === 'SMS'
      ? 'bg-amber-50 text-amber-700 border-amber-100'
      : 'bg-blue-50 text-blue-950 border-blue-100';

  const statusBadge = (s: CampaignStatus) =>
    s === 'Completed'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'Sending'
      ? 'bg-blue-50 text-blue-950 border-blue-100'
      : s === 'Scheduled'
      ? 'bg-purple-50 text-purple-700 border-purple-100'
      : 'bg-slate-100 text-slate-600 border-slate-200';

  const stepTitles = [
    'Campaign name & channel',
    'Target customer segment',
    'Draft message content',
    'Schedule & A/B testing',
    'Review & launch',
  ];

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
            <h1 className="text-[15px] font-semibold text-slate-900">Campaigns</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Multi-channel marketing across WhatsApp, SMS, and Email
            </p>
          </div>
          <button
            onClick={() => {
              setCreateOpen(true);
              setWizardStep(1);
            }}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New campaign</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Active campaigns</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">4</p>
              <p className="text-[13px] text-emerald-600 mt-0.5 inline-flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                2 sending · 2 scheduled
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4" />
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Messages sent</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">17,250</p>
              <p className="text-[13px] text-emerald-600 mt-0.5 inline-flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                +24.1% this week
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Send className="w-4 h-4" />
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Avg. open rate</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">76.9%</p>
              <p className="text-[13px] text-emerald-600 mt-0.5 inline-flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                High WhatsApp
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4" />
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Avg. click rate</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">25.9%</p>
              <p className="text-[13px] text-emerald-600 mt-0.5 inline-flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                +4.2% lift
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Percent className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* TABS */}
        <div className="bg-white border border-slate-200 rounded-sm p-0.5 inline-flex gap-0.5">
          {(['All', 'Draft', 'Scheduled', 'Sending', 'Completed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 rounded-sm text-[13px] font-medium transition ${
                activeTab === tab ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* TABLE */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <p className="text-[13px] font-medium text-slate-700">
              Campaigns · {filtered.length}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2 px-3 font-medium">Campaign</th>
                  <th className="py-2 px-3 font-medium">Channel</th>
                  <th className="py-2 px-3 font-medium">Audience</th>
                  <th className="py-2 px-3 font-medium text-right">Sent</th>
                  <th className="py-2 px-3 font-medium text-right">Open</th>
                  <th className="py-2 px-3 font-medium text-right">Click</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium">Date</th>
                  <th className="py-2 px-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 text-[13px]">
                      No campaigns for this status.
                    </td>
                  </tr>
                ) : (
                  filtered.map((cmp) => (
                    <tr key={cmp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 font-medium text-slate-900 truncate max-w-[260px]">
                        {cmp.name}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${channelBadge(
                            cmp.channel
                          )}`}
                        >
                          {cmp.channel}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 truncate max-w-[220px]">
                        {cmp.audience}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700">
                        {cmp.sent.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-900">{cmp.openRate}</td>
                      <td className="py-2 px-3 text-right text-blue-950">{cmp.clickRate}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${statusBadge(
                            cmp.status
                          )}`}
                        >
                          {cmp.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-mono">{cmp.date}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => toast(`Opening stats for "${cmp.name}"`)}
                            className="px-2.5 py-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-[13px]"
                          >
                            Stats
                          </button>
                          <button
                            onClick={() => deleteCampaign(cmp.id)}
                            className="p-2 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 transition"
                            title="Delete campaign"
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
      </main>

      {/* WIZARD MODAL */}
      {createOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-3xl w-full max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Progress bar */}
            <div className="h-0.5 w-full bg-slate-100">
              <div
                className="h-full bg-blue-950 transition-all duration-300"
                style={{ width: `${(wizardStep / 5) * 100}%` }}
              />
            </div>

            {/* Header */}
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-slate-900 inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-950" />
                  New campaign · Step {wizardStep} of 5
                </h3>
                <p className="text-[13px] text-slate-500 mt-0.5">{stepTitles[wizardStep - 1]}</p>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">

              {/* STEP 1 */}
              {wizardStep === 1 && (
                <>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Campaign name</label>
                    <input
                      type="text"
                      placeholder="e.g. End of month M-Pesa discount promo"
                      value={newCampName}
                      onChange={(e) => setNewCampName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Marketing channel</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['WhatsApp', 'SMS', 'Email'] as CampaignChannel[]).map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => setNewCampChannel(ch)}
                          className={`p-2 rounded-sm border text-left font-medium transition flex flex-col gap-1.5 ${
                            newCampChannel === ch
                              ? 'border-blue-950 bg-blue-50 text-blue-950'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {ch === 'WhatsApp' && <MessageSquare className="w-4 h-4 text-emerald-600" />}
                          {ch === 'SMS' && <Smartphone className="w-4 h-4 text-amber-600" />}
                          {ch === 'Email' && <Mail className="w-4 h-4 text-blue-600" />}
                          <span className="text-[13px]">{ch}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* STEP 2 */}
              {wizardStep === 2 && (
                <div>
                  <label className="block font-medium text-slate-700 mb-2">Target audience</label>
                  <div className="space-y-1.5">
                    {AUDIENCES.map((seg) => (
                      <button
                        key={seg}
                        type="button"
                        onClick={() => setNewCampAudience(seg)}
                        className={`w-full flex items-center justify-between gap-2 p-2 rounded-sm border text-left transition ${
                          newCampAudience === seg
                            ? 'border-blue-950 bg-blue-50 text-blue-950 font-medium'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{seg}</span>
                        <span
                          className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                            newCampAudience === seg
                              ? 'border-blue-950 bg-blue-950'
                              : 'border-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {wizardStep === 3 && (
                <>
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-slate-700">Message content</label>
                    <button
                      type="button"
                      onClick={() => setNewCampBody(TEMPLATES[0].preview)}
                      className="text-[13px] font-medium text-blue-950 hover:underline"
                    >
                      Load template
                    </button>
                  </div>

                  {newCampChannel === 'Email' && (
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Subject line</label>
                      <input
                        type="text"
                        placeholder="e.g. Your weekly store update"
                        value={newCampSubject}
                        onChange={(e) => setNewCampSubject(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Message body</label>
                    <textarea
                      rows={5}
                      placeholder="Hi {{customer_name}}, check out our new catalog…"
                      value={newCampBody}
                      onChange={(e) => setNewCampBody(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] text-slate-500">Variables:</span>
                    {['{{customer_name}}', '{{phone}}', '{{checkout_link}}', '{{store_name}}'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setNewCampBody((prev) => prev + ' ' + v)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-sm font-mono text-[13px] transition"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* STEP 4 */}
              {wizardStep === 4 && (
                <>
                  <label className="block font-medium text-slate-700">Delivery timing</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewCampScheduleType('now')}
                      className={`p-2 rounded-sm border text-left transition ${
                        newCampScheduleType === 'now'
                          ? 'border-blue-950 bg-blue-50 text-blue-950'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <p className="font-medium">Send immediately</p>
                      <p className="text-[13px] text-slate-500 mt-0.5">
                        Dispatch to audience right away.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCampScheduleType('scheduled')}
                      className={`p-2 rounded-sm border text-left transition ${
                        newCampScheduleType === 'scheduled'
                          ? 'border-blue-950 bg-blue-50 text-blue-950'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <p className="font-medium">Schedule for later</p>
                      <p className="text-[13px] text-slate-500 mt-0.5">
                        Pick an optimal dispatch time.
                      </p>
                    </button>
                  </div>

                  <label className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-sm cursor-pointer mt-2">
                    <div>
                      <p className="font-medium text-slate-900">A/B subject test</p>
                      <p className="text-[13px] text-slate-500">
                        Test two variations on 20% of the audience.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={newCampABTest}
                      onChange={(e) => setNewCampABTest(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950"
                    />
                  </label>
                </>
              )}

              {/* STEP 5 */}
              {wizardStep === 5 && (
                <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-3">
                  <p className="font-semibold text-slate-900 border-b border-slate-200 pb-2">
                    Campaign summary
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[13px] text-slate-500">Name</p>
                      <p className="font-medium text-slate-900">
                        {newCampName || 'Untitled campaign'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[13px] text-slate-500">Channel</p>
                      <p className="font-medium text-blue-950">{newCampChannel}</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-slate-500">Audience</p>
                      <p className="font-medium text-slate-900">{newCampAudience}</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-slate-500">Schedule</p>
                      <p className="font-medium text-emerald-700">
                        {newCampScheduleType === 'now' ? 'Send immediately' : 'Scheduled'}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-[13px] text-slate-500 mb-1">Message preview</p>
                    <p className="bg-white border border-slate-200 p-2 rounded-sm text-slate-700 italic whitespace-pre-wrap">
                      {newCampBody || 'No message body provided.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
              {wizardStep > 1 ? (
                <button
                  onClick={() => setWizardStep((prev) => prev - 1)}
                  className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              ) : (
                <div />
              )}

              {wizardStep < 5 ? (
                <button
                  onClick={() => setWizardStep((prev) => prev + 1)}
                  className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Next step
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={submitCampaign}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  <Send className="w-3.5 h-3.5" />
                  Launch campaign
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
