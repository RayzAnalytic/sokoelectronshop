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
  Rocket,
  MessageSquare,
  Smartphone,
  Package,
  Music2,
  Wrench,
  User,
  UserCheck,
  Clock,
  AlertCircle,
  ArrowLeft,
  Circle,
  Lock,
  Filter,
} from 'lucide-react';

type SupportTab = 'tickets' | 'docs' | 'status';

type TicketStatus = 'Open' | 'Pending' | 'In Progress' | 'Resolved' | 'Closed';
type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
type TicketCategory = 'Bug' | 'Feature Request' | 'Billing' | 'Other';

interface TicketMessage {
  id: string;
  author: string;
  authorRole: 'Customer' | 'Support Staff' | 'Admin';
  avatar: string;
  text: string;
  date: string;
}

interface Ticket {
  id: string;
  ticketNo: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  customerName: string;
  customerEmail: string;
  assignedTo: string | null;
  assignedAvatar: string | null;
  createdAt: string;
  lastUpdate: string;
  messages: TicketMessage[];
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

const SUPPORT_STAFF = [
  { name: 'Grace Njeri', avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=80', role: 'Support Staff' },
  { name: 'Brian Kipkorir', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80', role: 'Manager' },
  { name: 'Isaac Mutinda', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80', role: 'Administrator' },
  { name: 'Brenda Akinyi', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80', role: 'Sales Staff' },
];

const INITIAL_TICKETS: Ticket[] = [
  {
    id: 'tk-1',
    ticketNo: '#TK-8492',
    subject: 'M-Pesa STK Push timeout on Daraja sandbox',
    description: 'Getting a timeout error when trying to send STK push requests to the Daraja sandbox environment. This was working yesterday.',
    category: 'Bug',
    priority: 'High',
    status: 'In Progress',
    customerName: 'Isaac Mutinda',
    customerEmail: 'isaac.mutinda@gmail.com',
    assignedTo: 'Grace Njeri',
    assignedAvatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=80',
    createdAt: '2026-09-23 09:10',
    lastUpdate: '10 mins ago',
    messages: [
      {
        id: 'm-1',
        author: 'Isaac Mutinda',
        authorRole: 'Customer',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80',
        text: 'Getting a timeout error when trying to send STK push requests to the Daraja sandbox environment. This was working yesterday.',
        date: '2026-09-23 09:10',
      },
      {
        id: 'm-2',
        author: 'Grace Njeri',
        authorRole: 'Support Staff',
        avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=80',
        text: 'Thanks for reaching out. I am checking the sandbox callback URL configuration. Could you share the exact error code you are seeing?',
        date: '2026-09-23 09:22',
      },
      {
        id: 'm-3',
        author: 'Isaac Mutinda',
        authorRole: 'Customer',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80',
        text: 'The error is "Request timed out after 30000ms". No response code.',
        date: '2026-09-23 09:25',
      },
      {
        id: 'm-4',
        author: 'Grace Njeri',
        authorRole: 'Support Staff',
        avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=80',
        text: 'Noted. Safaricom sandbox has been known to have intermittent timeouts. Please try again in 5 minutes. If it persists, I will escalate to Safaricom support.',
        date: '2026-09-23 09:30',
      },
    ],
  },
  {
    id: 'tk-2',
    ticketNo: '#TK-8411',
    subject: 'WhatsApp Cloud API webhook verification failing',
    description: 'The webhook verification endpoint is returning a 403 Forbidden error during Meta Business Manager setup.',
    category: 'Bug',
    priority: 'Urgent',
    status: 'Open',
    customerName: 'Amina Mohamed',
    customerEmail: 'amina.m@outlook.com',
    assignedTo: null,
    assignedAvatar: null,
    createdAt: '2026-09-23 08:00',
    lastUpdate: '2 hours ago',
    messages: [
      {
        id: 'm-5',
        author: 'Amina Mohamed',
        authorRole: 'Customer',
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80',
        text: 'The webhook verification endpoint is returning a 403 Forbidden error during Meta Business Manager setup. This is blocking our WhatsApp store launch.',
        date: '2026-09-23 08:00',
      },
    ],
  },
  {
    id: 'tk-3',
    ticketNo: '#TK-8350',
    subject: 'How to configure eTIMS automated tax mapping?',
    description: 'Need guidance on mapping our product categories to eTIMS tax codes automatically.',
    category: 'Other',
    priority: 'Medium',
    status: 'Resolved',
    customerName: 'Kevin Otieno',
    customerEmail: 'kevin.otieno@yahoo.com',
    assignedTo: 'Brian Kipkorir',
    assignedAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80',
    createdAt: '2026-09-22 14:00',
    lastUpdate: 'Yesterday',
    messages: [
      {
        id: 'm-6',
        author: 'Kevin Otieno',
        authorRole: 'Customer',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80',
        text: 'Need guidance on mapping our product categories to eTIMS tax codes automatically.',
        date: '2026-09-22 14:00',
      },
      {
        id: 'm-7',
        author: 'Brian Kipkorir',
        authorRole: 'Support Staff',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80',
        text: 'You can configure this under Settings → Tax → eTIMS Mapping. I have also shared a step-by-step guide in the Help Docs section.',
        date: '2026-09-22 15:30',
      },
      {
        id: 'm-8',
        author: 'Kevin Otieno',
        authorRole: 'Customer',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80',
        text: 'Perfect, that worked. Thank you!',
        date: '2026-09-22 16:00',
      },
    ],
  },
  {
    id: 'tk-4',
    ticketNo: '#TK-8320',
    subject: 'Request for TikTok Pixel conversion tracking',
    description: 'Would like to integrate TikTok Pixel for our ad campaigns.',
    category: 'Feature Request',
    priority: 'Low',
    status: 'Pending',
    customerName: 'Grace Wanjiku',
    customerEmail: 'grace.w@gmail.com',
    assignedTo: 'Isaac Mutinda',
    assignedAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80',
    createdAt: '2026-09-21 10:00',
    lastUpdate: '2 days ago',
    messages: [
      {
        id: 'm-9',
        author: 'Grace Wanjiku',
        authorRole: 'Customer',
        avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=80',
        text: 'Would like to integrate TikTok Pixel for our ad campaigns. Is this supported?',
        date: '2026-09-21 10:00',
      },
      {
        id: 'm-10',
        author: 'Isaac Mutinda',
        authorRole: 'Admin',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80',
        text: 'This is on our roadmap for Q4. I will keep you updated once the integration is live.',
        date: '2026-09-21 11:00',
      },
    ],
  },
  {
    id: 'tk-5',
    ticketNo: '#TK-8290',
    subject: 'Closed: duplicate billing inquiry',
    description: 'Customer queried duplicate charge that was already resolved.',
    category: 'Billing',
    priority: 'Medium',
    status: 'Closed',
    customerName: 'David Kiprop',
    customerEmail: 'd.kiprop@kenya.co.ke',
    assignedTo: 'Grace Njeri',
    assignedAvatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=80',
    createdAt: '2026-09-20 10:00',
    lastUpdate: '3 days ago',
    messages: [
      {
        id: 'm-11',
        author: 'David Kiprop',
        authorRole: 'Customer',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80',
        text: 'I was charged twice for order #SKO-9815.',
        date: '2026-09-20 10:00',
      },
      {
        id: 'm-12',
        author: 'Grace Njeri',
        authorRole: 'Support Staff',
        avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=80',
        text: 'We have investigated and confirmed the duplicate was already reversed. Closing this ticket.',
        date: '2026-09-20 12:00',
      },
    ],
  },
];

const TICKET_STATUSES: TicketStatus[] = ['Open', 'Pending', 'In Progress', 'Resolved', 'Closed'];

export default function SupportPage() {
  const [activeTab, setActiveTab] = useState<SupportTab>('tickets');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [tickets, setTickets] = useState<Ticket[]>(INITIAL_TICKETS);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState<TicketCategory>('Bug');
  const [ticketPriority, setTicketPriority] = useState<TicketPriority>('Medium');
  const [ticketDesc, setTicketDesc] = useState('');

  const [replyText, setReplyText] = useState('');

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
    { id: 'whatsapp', name: 'WhatsApp Cloud API Gateway', status: 'operational', uptime: '99.92%', lastChecked: 'Just now' },
    { id: 'tiktok', name: 'TikTok Conversion Pixel API', status: 'operational', uptime: '100.0%', lastChecked: 'Just now' },
    { id: 'email', name: 'SMTP Mail Dispatcher', status: 'operational', uptime: '99.96%', lastChecked: 'Just now' },
  ]);

  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const anyModalOpen = newTicketOpen || contactOpen;

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) || null;

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
      id: `tk-${Date.now()}`,
      ticketNo: `#TK-${Math.floor(1000 + Math.random() * 9000)}`,
      subject: ticketSubject,
      description: ticketDesc,
      category: ticketCategory,
      priority: ticketPriority,
      status: 'Open',
      customerName: 'Admin User',
      customerEmail: 'admin@sokoflow.co.ke',
      assignedTo: null,
      assignedAvatar: null,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      lastUpdate: 'Just now',
      messages: [
        {
          id: `m-${Date.now()}`,
          author: 'Admin User',
          authorRole: 'Customer',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80',
          text: ticketDesc,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        },
      ],
    };
    setTickets([newTicket, ...tickets]);
    setNewTicketOpen(false);
    setTicketSubject('');
    setTicketDesc('');
    toast('Ticket submitted');
  };

  const updateTicketStatus = (id: string, status: TicketStatus) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status, lastUpdate: 'Just now' }
          : t
      )
    );
    toast(`Ticket marked as ${status}`);
  };

  const assignTicket = (id: string, staffName: string | null) => {
    const staff = SUPPORT_STAFF.find((s) => s.name === staffName);
    setTickets((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, assignedTo: staffName, assignedAvatar: staff?.avatar || null, lastUpdate: 'Just now' }
          : t
      )
    );
    toast(staffName ? `Assigned to ${staffName}` : 'Unassigned');
  };

  const sendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;
    const newMessage: TicketMessage = {
      id: `m-${Date.now()}`,
      author: 'Admin User',
      authorRole: 'Support Staff',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80',
      text: replyText.trim(),
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };
    setTickets((prev) =>
      prev.map((t) =>
        t.id === selectedTicket.id
          ? {
            ...t,
            messages: [...t.messages, newMessage],
            lastUpdate: 'Just now',
            status: t.status === 'Open' ? 'In Progress' : t.status,
          }
          : t
      )
    );
    setReplyText('');
    toast('Reply sent');
  };

  const runDiagnostics = () => {
    setIsRunningDiagnostics(true);
    setTimeout(() => {
      setIsRunningDiagnostics(false);
      toast('All systems operational (100%)');
    }, 1800);
  };

  const priorityBadge = (p: TicketPriority) =>
    p === 'Urgent'
      ? 'bg-red-50 text-red-600 border-red-100'
      : p === 'High'
        ? 'bg-amber-50 text-amber-700 border-amber-100'
        : p === 'Medium'
          ? 'bg-blue-50 text-blue-950 border-blue-100'
          : 'bg-slate-100 text-slate-600 border-slate-200';

  const statusBadge = (s: TicketStatus) =>
    s === 'Resolved'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'In Progress'
        ? 'bg-blue-50 text-blue-950 border-blue-100'
        : s === 'Open'
          ? 'bg-amber-50 text-amber-700 border-amber-100'
          : s === 'Pending'
            ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
            : 'bg-slate-100 text-slate-600 border-slate-200';

  const statusIcon = (s: TicketStatus) =>
    s === 'Resolved' ? (
      <CheckCircle2 className="w-3 h-3" />
    ) : s === 'In Progress' ? (
      <Clock className="w-3 h-3" />
    ) : s === 'Open' ? (
      <AlertCircle className="w-3 h-3" />
    ) : s === 'Pending' ? (
      <Circle className="w-3 h-3" />
    ) : (
      <Lock className="w-3 h-3" />
    );

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.ticketNo.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.customerName.toLowerCase().includes(q) ||
        (t.assignedTo ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusCounts: Record<string, number> = { All: tickets.length };
  TICKET_STATUSES.forEach((s) => {
    statusCounts[s] = tickets.filter((t) => t.status === s).length;
  });

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

        {/* TABS */}
        <div className="max-w-[1600px] mx-auto px-3 flex items-center gap-0.5 border-t border-slate-100 pt-2 overflow-x-auto">
          {[
            { id: 'tickets' as const, label: 'Tickets', icon: LifeBuoy, count: tickets.length },
            { id: 'docs' as const, label: 'Help docs', icon: HelpCircle },
            { id: 'status' as const, label: 'System status', icon: Server },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium border-b-2 transition whitespace-nowrap ${isActive
                    ? 'border-blue-950 text-blue-950'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-950' : 'text-slate-400'}`} />
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-sm text-[13px] ${isActive ? 'bg-blue-950 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* TICKETS TAB */}
        {activeTab === 'tickets' && !selectedTicket && (
          <>
            {/* LIFECYCLE BANNER */}
            <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 flex items-start gap-2">
              <Filter className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
              <div className="text-[13px]">
                <p className="font-medium text-blue-950">Ticket lifecycle</p>
                <p className="text-blue-800 mt-0.5">
                  <span className="font-medium">Customer</span> → Support Ticket → Assigned Staff → Conversation → Resolution.
                  Statuses flow: Open → Pending → In Progress → Resolved → Closed.
                </p>
              </div>
            </div>

            {/* STATUS FILTER CHIPS */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center gap-1.5 overflow-x-auto">
              <span className="text-[13px] font-medium text-slate-500 shrink-0 pr-1">Status:</span>
              <button
                onClick={() => setStatusFilter(null)}
                className={`px-2.5 py-1.5 rounded-sm text-[13px] font-medium transition shrink-0 ${statusFilter === null
                    ? 'bg-blue-950 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                All ({statusCounts.All})
              </button>
              {TICKET_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1.5 rounded-sm text-[13px] font-medium transition shrink-0 ${statusFilter === s
                      ? 'bg-blue-950 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                >
                  {s} ({statusCounts[s]})
                </button>
              ))}
            </div>

            {/* SEARCH */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400 ml-1" />
              <input
                type="text"
                placeholder="Search ticket #, subject, customer, or assignee…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none py-0.5"
              />
            </div>

            {/* TICKETS TABLE */}
            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <p className="text-[13px] font-medium text-slate-700">Support tickets</p>
                <span className="text-[13px] text-slate-500">{filteredTickets.length}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-3 font-medium">Ticket</th>
                      <th className="py-2 px-3 font-medium">Subject</th>
                      <th className="py-2 px-3 font-medium">Customer</th>
                      <th className="py-2 px-3 font-medium">Assigned to</th>
                      <th className="py-2 px-3 font-medium">Priority</th>
                      <th className="py-2 px-3 font-medium">Status</th>
                      <th className="py-2 px-3 font-medium">Last update</th>
                      <th className="py-2 px-3 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTickets.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 text-[13px]">
                          No tickets match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredTickets.map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => setSelectedTicketId(t.id)}
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <td className="py-2 px-3 font-mono font-medium text-blue-950">
                            {t.ticketNo}
                          </td>
                          <td className="py-2 px-3 text-slate-900 font-medium truncate max-w-[240px]">
                            {t.subject}
                          </td>
                          <td className="py-2 px-3 text-slate-600 truncate max-w-[150px]">
                            {t.customerName}
                          </td>
                          <td className="py-2 px-3">
                            {t.assignedTo ? (
                              <div className="flex items-center gap-1.5">
                                <img
                                  src={t.assignedAvatar || ''}
                                  alt=""
                                  className="w-5 h-5 rounded-full object-cover border border-slate-200"
                                />
                                <span className="text-slate-700 truncate">{t.assignedTo}</span>
                              </div>
                            ) : (
                              <span className="text-[13px] text-slate-400 italic">Unassigned</span>
                            )}
                          </td>
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
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border ${statusBadge(
                                t.status
                              )}`}
                            >
                              {statusIcon(t.status)}
                              {t.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-400">{t.lastUpdate}</td>
                          <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedTicketId(t.id)}
                              className="px-2.5 py-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-[13px]"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* TICKET DETAIL VIEW */}
        {activeTab === 'tickets' && selectedTicket && (
          <div className="space-y-3">
            {/* Back + actions bar */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setSelectedTicketId(null)}
                  className="h-8 w-8 rounded-sm bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono font-medium text-blue-950">{selectedTicket.ticketNo}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border ${statusBadge(
                        selectedTicket.status
                      )}`}
                    >
                      {statusIcon(selectedTicket.status)}
                      {selectedTicket.status}
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${priorityBadge(
                        selectedTicket.priority
                      )}`}
                    >
                      {selectedTicket.priority}
                    </span>
                  </div>
                  <p className="text-[13px] text-slate-500 mt-0.5 truncate">{selectedTicket.subject}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedTicket.status}
                  onChange={(e) => updateTicketStatus(selectedTicket.id, e.target.value as TicketStatus)}
                  className="bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-blue-950"
                >
                  {TICKET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      Status: {s}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedTicket.assignedTo ?? ''}
                  onChange={(e) => assignTicket(selectedTicket.id, e.target.value || null)}
                  className="bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-blue-950"
                >
                  <option value="">Unassigned</option>
                  {SUPPORT_STAFF.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name} · {s.role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* LEFT: Conversation */}
              <div className="lg:col-span-2 space-y-3">
                <div className="bg-white border border-slate-200 rounded-sm">
                  <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-slate-900">Conversation</p>
                    <span className="text-[13px] text-slate-500">
                      {selectedTicket.messages.length} messages
                    </span>
                  </div>

                  <div className="p-3 space-y-3 max-h-[500px] overflow-y-auto">
                    {selectedTicket.messages.map((m) => {
                      const isStaff = m.authorRole !== 'Customer';
                      return (
                        <div
                          key={m.id}
                          className={`flex items-start gap-2 ${isStaff ? 'flex-row-reverse' : ''}`}
                        >
                          <img
                            src={m.avatar}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <div className={`max-w-[75%] ${isStaff ? 'items-end text-right' : ''} flex flex-col`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[13px] font-medium text-slate-900">{m.author}</span>
                              <span
                                className={`text-[13px] px-1.5 py-0.5 rounded-sm border ${isStaff
                                    ? 'bg-blue-50 text-blue-950 border-blue-100'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                              >
                                {m.authorRole}
                              </span>
                            </div>
                            <div
                              className={`rounded-sm p-2 text-[13px] ${isStaff
                                  ? 'bg-blue-950 text-white'
                                  : 'bg-slate-100 text-slate-800 border border-slate-200'
                                }`}
                            >
                              {m.text}
                            </div>
                            <span className="text-[13px] font-mono text-slate-400 mt-1">{m.date}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reply form */}
                  {selectedTicket.status !== 'Closed' ? (
                    <form onSubmit={sendReply} className="p-3 border-t border-slate-200 space-y-2">
                      <textarea
                        rows={3}
                        placeholder="Type your reply…"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 hover:text-slate-900 font-medium"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          Attach file
                        </button>
                        <button
                          type="submit"
                          disabled={!replyText.trim()}
                          className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Send reply
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="p-3 border-t border-slate-200 bg-slate-50 text-center">
                      <p className="text-[13px] text-slate-500 inline-flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        This ticket is closed. Reopen to continue the conversation.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Sidebar */}
              <div className="space-y-3">
                {/* Customer */}
                <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <p className="text-[13px] font-semibold text-slate-900">Customer</p>
                  <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[13px]">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-900 font-medium">{selectedTicket.customerName}</span>
                    </div>
                    <p className="font-mono text-slate-500">{selectedTicket.customerEmail}</p>
                  </div>
                </div>

                {/* Ticket details */}
                <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <p className="text-[13px] font-semibold text-slate-900">Ticket details</p>
                  <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[13px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Category</span>
                      <span className="font-medium text-slate-900">{selectedTicket.category}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Priority</span>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${priorityBadge(
                          selectedTicket.priority
                        )}`}
                      >
                        {selectedTicket.priority}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Status</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border ${statusBadge(
                          selectedTicket.status
                        )}`}
                      >
                        {statusIcon(selectedTicket.status)}
                        {selectedTicket.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-slate-500">Created</span>
                      <span className="font-mono text-slate-700">{selectedTicket.createdAt}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Last update</span>
                      <span className="font-mono text-slate-700">{selectedTicket.lastUpdate}</span>
                    </div>
                  </div>
                </div>

                {/* Assignee */}
                <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <p className="text-[13px] font-semibold text-slate-900">Assigned staff</p>
                  <div className="pt-2 border-t border-slate-100">
                    {selectedTicket.assignedTo ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={selectedTicket.assignedAvatar || ''}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover border border-slate-200"
                        />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-slate-900">
                            {selectedTicket.assignedTo}
                          </p>
                          <p className="text-[13px] text-slate-500">
                            {SUPPORT_STAFF.find((s) => s.name === selectedTicket.assignedTo)?.role}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[13px] text-slate-400 italic inline-flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5" />
                        Not yet assigned
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DOCS TAB */}
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

        {/* STATUS TAB */}
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
                    onChange={(e) => setTicketCategory(e.target.value as TicketCategory)}
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
                    onChange={(e) => setTicketPriority(e.target.value as TicketPriority)}
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

      {/* CONTACT MODAL */}
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
