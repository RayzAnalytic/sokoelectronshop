'use client';

import React, { useEffect, useState } from 'react';
import {
  LifeBuoy,
  Plus,
  MessageCircle,
  Search,
  CheckCircle2,
  X,
  RefreshCw,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Send,
  HelpCircle,
  Server,
  // NEW: doc category icons
  Rocket,
  MessageSquare,
  Smartphone,
  Package,
  Music2,
  Wrench,
} from 'lucide-react';

type SupportTab = 'tickets' | 'docs' | 'status';

interface Ticket {
  id: string;
  ticketNo: string;
  subject: string;
  category: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  lastUpdate: string;
}

interface DocCategory {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  articles: { title: string; content: string }[];
}

interface ServiceStatus {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'outage';
  uptime: string;
  lastChecked: string;
}

export default function SupportPage() {
  const [activeTab, setActiveTab] = useState<SupportTab>('tickets');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [tickets, setTickets] = useState<Ticket[]>([
    { id: '1', ticketNo: '#TK-8492', subject: 'M-Pesa STK Push timeout on Daraja sandbox', category: 'Billing', priority: 'High', status: 'In Progress', lastUpdate: '10 mins ago' },
    { id: '2', ticketNo: '#TK-8411', subject: 'WhatsApp Cloud API webhook verification failing', category: 'Bug', priority: 'Urgent', status: 'Open', lastUpdate: '2 hours ago' },
    { id: '3', ticketNo: '#TK-8350', subject: 'How to configure eTIMS automated tax mapping?', category: 'Other', priority: 'Medium', status: 'Resolved', lastUpdate: 'Yesterday' },
  ]);

  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('Bug');
  const [ticketPriority, setTicketPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [ticketDesc, setTicketDesc] = useState('');

  const [docSearch, setDocSearch] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>('whatsapp');

  const docCategories: DocCategory[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: Rocket,
      tint: 'bg-blue-50 text-blue-950 border-blue-100',
      articles: [
        { title: 'Setting up your store', content: 'Step-by-step guide to store profile, currency, and physical address.' },
        { title: 'Connecting your domain', content: 'How to point your DNS records to our servers.' },
      ],
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp Cloud API',
      icon: MessageSquare,
      tint: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      articles: [
        { title: 'Connecting Meta Business Manager', content: 'Authorize your phone number and configure webhook endpoints.' },
        { title: 'Automated order template approval', content: 'Guidelines for getting templates approved by Meta.' },
      ],
    },
    {
      id: 'payments',
      title: 'M-Pesa & Payments',
      icon: Smartphone,
      tint: 'bg-amber-50 text-amber-700 border-amber-100',
      articles: [
        { title: 'Daraja API consumer key & secret', content: 'How to obtain live credentials from Safaricom portal.' },
        { title: 'Configuring C2B Paybill and STK Push', content: 'Receive instant payment confirmations on checkout.' },
      ],
    },
    {
      id: 'products',
      title: 'Products & Inventory',
      icon: Package,
      tint: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      articles: [
        { title: 'Importing products via CSV', content: 'Format your spreadsheet with SKUs, pricing, and stock.' },
        { title: 'Managing variant options', content: 'Create color, size, and weight variants for items.' },
      ],
    },
    {
      id: 'tiktok',
      title: 'TikTok Pixel',
      icon: Music2,
      tint: 'bg-rose-50 text-rose-700 border-rose-100',
      articles: [
        { title: 'Tracking ad conversions', content: 'Install your TikTok Pixel ID to monitor checkout events.' },
      ],
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: Wrench,
      tint: 'bg-slate-100 text-slate-700 border-slate-200',
      articles: [
        { title: 'Resolving eTIMS errors', content: 'Check your KRA PIN and control unit API secret keys.' },
        { title: 'Fixing SSL warnings', content: 'Ensure all assets load over secure HTTPS connections.' },
      ],
    },
  ];

  const [services] = useState<ServiceStatus[]>([
    { id: 'web', name: 'Storefront & Admin Web App', status: 'operational', uptime: '99.98%', lastChecked: 'Just now' },
    { id: 'db', name: 'PostgreSQL Database & Redis', status: 'operational', uptime: '99.95%', lastChecked: 'Just now' },
    { id: 'mpesa', name: 'Safaricom M-Pesa Daraja API', status: 'operational', uptime: '99.90%', lastChecked: 'Just now' },
    { id: 'airtel', name: 'Airtel Money API', status: 'operational', uptime: '99.85%', lastChecked: 'Just now' },
    { id: 'stripe', name: 'Stripe International Gateway', status: 'operational', uptime: '99.99%', lastChecked: 'Just now' },
    { id: 'whatsapp', name: 'WhatsApp Cloud API Gateway', status: 'operational', uptime: '99.92%', lastChecked: 'Just now' },
    { id: 'tiktok', name: 'TikTok Conversion Pixel API', status: 'operational', uptime: '100.0%', lastChecked: 'Just now' },
    { id: 'email', name: 'SMTP Mail Dispatcher', status: 'operational', uptime: '99.96%', lastChecked: 'Just now' },
  ]);

  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const anyModalOpen = newTicketOpen || contactOpen;

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (!anyModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNewTicketOpen(false);
        setContactOpen(false);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [anyModalOpen]);

  const toast = (msg: string) => setToastMessage(msg);

  const createTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketDesc.trim()) return;
    const newTicket: Ticket = {
      id: Date.now().toString(),
      ticketNo: `#TK-${Math.floor(1000 + Math.random() * 9000)}`,
      subject: ticketSubject,
      category: ticketCategory,
      priority: ticketPriority,
      status: 'Open',
      lastUpdate: 'Just now',
    };
    setTickets([newTicket, ...tickets]);
    setNewTicketOpen(false);
    setTicketSubject('');
    setTicketDesc('');
    toast('Ticket submitted');
  };

  const runDiagnostics = () => {
    setIsRunningDiagnostics(true);
    setTimeout(() => {
      setIsRunningDiagnostics(false);
      toast('All systems operational (100%)');
    }, 1800);
  };

  const priorityBadge = (p: Ticket['priority']) =>
    p === 'Urgent'
      ? 'bg-red-50 text-red-600 border-red-100'
      : p === 'High'
      ? 'bg-amber-50 text-amber-700 border-amber-100'
      : 'bg-slate-100 text-slate-600 border-slate-200';

  const statusBadge = (s: Ticket['status']) =>
    s === 'Resolved'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'In Progress'
      ? 'bg-blue-50 text-blue-950 border-blue-100'
      : 'bg-slate-100 text-slate-600 border-slate-200';

  const filteredDocs = docCategories.filter(
    (cat) =>
      cat.title.toLowerCase().includes(docSearch.toLowerCase()) ||
      cat.articles.some(
        (a) =>
          a.title.toLowerCase().includes(docSearch.toLowerCase()) ||
          a.content.toLowerCase().includes(docSearch.toLowerCase())
      )
  );

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
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Support & help center</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Manage tickets, browse documentation, and check platform status
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNewTicketOpen(true)}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New ticket</span>
            </button>
            <button
              onClick={() => setContactOpen(true)}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Contact</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* TABS */}
        <div className="bg-white border border-slate-200 rounded-sm p-0.5 inline-flex gap-0.5">
          {[
            { id: 'tickets' as const, label: 'My tickets', icon: LifeBuoy },
            { id: 'docs' as const, label: 'Help docs', icon: HelpCircle },
            { id: 'status' as const, label: 'System status', icon: Server },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium transition ${
                  isActive ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: TICKETS */}
        {activeTab === 'tickets' && (
          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-slate-700">Support tickets</p>
                <p className="text-[13px] text-slate-500">
                  Track and manage your engineering inquiries
                </p>
              </div>
              <span className="text-[13px] text-slate-500">{tickets.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2 px-3 font-medium">Ticket</th>
                    <th className="py-2 px-3 font-medium">Subject</th>
                    <th className="py-2 px-3 font-medium">Category</th>
                    <th className="py-2 px-3 font-medium">Priority</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 font-medium">Last update</th>
                    <th className="py-2 px-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 font-mono font-medium text-blue-950">
                        {t.ticketNo}
                      </td>
                      <td className="py-2 px-3 text-slate-900 font-medium truncate max-w-[280px]">
                        {t.subject}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{t.category}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${priorityBadge(
                            t.priority
                          )}`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${statusBadge(
                            t.status
                          )}`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-400">{t.lastUpdate}</td>
                      <td className="py-2 px-3">
                        <button
                          onClick={() => toast(`Opened ${t.ticketNo}`)}
                          className="px-2.5 py-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-[13px]"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: DOCS */}
        {activeTab === 'docs' && (
          <div className="space-y-3">
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400 ml-1" />
              <input
                type="text"
                placeholder="Search help articles and API docs…"
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                className="w-full bg-transparent text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none py-0.5"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredDocs.map((cat) => {
                const isExpanded = expandedCategory === cat.id;
                const Icon = cat.icon;
                return (
                  <div
                    key={cat.id}
                    className="bg-white border border-slate-200 rounded-sm p-2 space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span
                          className={`w-9 h-9 rounded-sm border flex items-center justify-center ${cat.tint}`}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        <button
                          onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                          className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-1"
                        >
                          {isExpanded ? 'Hide' : 'View'}
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <p className="text-[13px] font-medium text-slate-900">{cat.title}</p>
                      <p className="text-[13px] text-slate-500">
                        {cat.articles.length} articles
                      </p>

                      {isExpanded && (
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          {cat.articles.map((art, idx) => (
                            <div
                              key={idx}
                              className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-1"
                            >
                              <p className="text-[13px] font-medium text-slate-900">
                                {art.title}
                              </p>
                              <p className="text-[13px] text-slate-600">{art.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: STATUS */}
        {activeTab === 'status' && (
          <div className="bg-white border border-slate-200 rounded-sm">
            <div className="px-3 py-2 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-[13px] font-medium text-slate-700">System status</p>
                <p className="text-[13px] text-slate-500">
                  Real-time uptime monitoring for gateways and APIs
                </p>
              </div>
              <button
                onClick={runDiagnostics}
                disabled={isRunningDiagnostics}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50 transition"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRunningDiagnostics ? 'animate-spin' : ''}`}
                />
                {isRunningDiagnostics ? 'Running…' : 'Run diagnostics'}
              </button>
            </div>

            <div className="p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {services.map((srv) => (
                <div
                  key={srv.id}
                  className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Operational
                    </span>
                    <span className="font-mono text-[13px] text-slate-700">{srv.uptime}</span>
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-slate-900">{srv.name}</p>
                    <p className="text-[13px] text-slate-400 mt-0.5">
                      Last checked: {srv.lastChecked}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* NEW TICKET MODAL */}
      {newTicketOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setNewTicketOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900">Create support ticket</h3>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Our team responds within 24 hours
                </p>
              </div>
              <button
                onClick={() => setNewTicketOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={createTicket}
              className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">Subject *</label>
                <input
                  type="text"
                  required
                  placeholder="Brief summary of your inquiry…"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  >
                    <option value="Bug">Bug</option>
                    <option value="Feature Request">Feature request</option>
                    <option value="Billing">Billing</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={ticketPriority}
                    onChange={(e) => setTicketPriority(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Description *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Steps to reproduce, error logs, or detailed explanation…"
                  value={ticketDesc}
                  onChange={(e) => setTicketDesc(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Attachments (optional)
                </label>
                <button
                  type="button"
                  className="w-full border border-dashed border-slate-300 hover:border-blue-950 hover:bg-blue-50/20 rounded-sm p-4 text-center transition"
                >
                  <Paperclip className="w-5 h-5 text-slate-400 mx-auto" />
                  <p className="text-[13px] text-slate-600 font-medium mt-1">
                    Click to upload screenshots or logs
                  </p>
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewTicketOpen(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Submit ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONTACT DEVELOPER MODAL */}
      {contactOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setContactOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl space-y-3 text-center text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Direct developer support</h3>
              <p className="text-[13px] text-slate-500 mt-1">
                Get in touch for custom engineering or urgent escalations.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 text-left space-y-2 text-[13px]">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Developer</span>
                <span className="font-medium text-slate-900">Isaac Mutinda</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Hours</span>
                <span className="font-medium text-slate-900">Mon–Sat · 8 AM–8 PM EAT</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Email</span>
                <span className="font-mono text-slate-900">admin@sokoflow.co.ke</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setContactOpen(false)}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
              <a
                href="https://wa.me/254712345678"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-sm text-[13px]"
              >
                <Send className="w-3.5 h-3.5" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
