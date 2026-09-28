'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  CheckCircle2,
  X,
  Trash2,
  Edit3,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Eye,
  Save,
  Send,
  Globe,
  Bold,
  Italic,
  Heading,
  List,
  Link as LinkIcon,
  Image as ImageIcon,
  Code,
  AlertCircle,
  Search,
  Lock,
} from 'lucide-react';

// --- TYPES ---
type PageStatus = 'Published' | 'Draft' | 'Scheduled';

type PageType = 'home' | 'about' | 'contact' | 'faq' | 'legal' | 'custom';

type SectionType =
  | 'hero'
  | 'richtext'
  | 'faq'
  | 'cta'
  | 'contact-info'
  | 'features'
  | 'team';

interface PageSection {
  id: string;
  type: SectionType;
  title?: string;
  body?: string;
  items?: { id: string; q?: string; a?: string; title?: string; desc?: string; icon?: string }[];
  ctaLabel?: string;
  ctaHref?: string;
}

interface PageRevision {
  id: string;
  savedAt: string;
  author: string;
  title: string;
  content: string;
  note?: string;
}

interface CmsPage {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  status: PageStatus;
  lastUpdated: string;
  author: string;
  content: string;
  sections: PageSection[];
  metaTitle?: string;
  metaDescription?: string;
  template?: string;
  system: boolean;
  revisions: PageRevision[];
}

// --- INITIAL DATA ---
const INITIAL_PAGES: CmsPage[] = [
  {
    id: 'page-home',
    title: 'Home',
    slug: '/',
    type: 'home',
    status: 'Published',
    lastUpdated: 'Sep 20, 2026',
    author: 'Isaac Mutinda',
    content:
      'SokoFlow — Kenya\u2019s conversational commerce platform. Automate WhatsApp orders, M-Pesa payments, and catalog sync in one dashboard.',
    sections: [
      {
        id: 's-home-1',
        type: 'hero',
        title: 'Sell on WhatsApp. Get paid on M-Pesa.',
        body: 'Turn every WhatsApp chat into a checkout. Automated catalogs, instant STK push, real-time order sync.',
        ctaLabel: 'Start free trial',
        ctaHref: '/signup',
      },
      {
        id: 's-home-2',
        type: 'features',
        title: 'Built for African merchants',
        items: [
          { id: 'f1', title: 'WhatsApp catalog', desc: 'Push your products into WhatsApp Business in one click.' },
          { id: 'f2', title: 'M-Pesa STK', desc: 'Instant payment prompts inside the customer\u2019s chat.' },
          { id: 'f3', title: 'Automated replies', desc: 'Trigger-based messaging for carts, orders, and support.' },
        ],
      },
      {
        id: 's-home-3',
        type: 'cta',
        title: 'Ready to grow?',
        body: 'Launch your conversational storefront in under 10 minutes.',
        ctaLabel: 'Create my store',
        ctaHref: '/signup',
      },
    ],
    metaTitle: 'SokoFlow | WhatsApp & M-Pesa Commerce for Kenya',
    metaDescription:
      'Automate WhatsApp orders and M-Pesa payments with SokoFlow — the conversational commerce platform built for Kenyan merchants.',
    template: 'Landing Page',
    system: true,
    revisions: [],
  },
  {
    id: 'page-about',
    title: 'About Us',
    slug: '/about',
    type: 'about',
    status: 'Published',
    lastUpdated: 'Sep 20, 2026',
    author: 'Isaac Mutinda',
    content:
      'Welcome to SokoFlow, Kenya\u2019s premier conversational commerce platform connecting WhatsApp businesses with M-Pesa automated payments.',
    sections: [
      { id: 's-about-1', type: 'hero', title: 'Our mission', body: 'Empower every African merchant to sell where their customers already are — WhatsApp.' },
      { id: 's-about-2', type: 'richtext', title: 'Our story', body: 'Founded in Nairobi in 2023, SokoFlow grew out of a simple frustration: merchants lost sales because checkout lived outside the chat.' },
      {
        id: 's-about-3',
        type: 'team',
        title: 'Meet the team',
        items: [
          { id: 't1', title: 'Isaac Mutinda', desc: 'Co-founder & CEO' },
          { id: 't2', title: 'Faith Kamau', desc: 'Head of Product' },
        ],
      },
    ],
    metaTitle: 'About SokoFlow | Conversational Commerce Kenya',
    metaDescription:
      'Learn about SokoFlow\u2019s mission to empower African merchants with automated WhatsApp and M-Pesa storefronts.',
    template: 'Standard Layout',
    system: true,
    revisions: [],
  },
  {
    id: 'page-contact',
    title: 'Contact',
    slug: '/contact',
    type: 'contact',
    status: 'Published',
    lastUpdated: 'Sep 18, 2026',
    author: 'Isaac Mutinda',
    content: 'Get in touch with our support and engineering team in Nairobi, Kenya.',
    sections: [
      { id: 's-contact-1', type: 'hero', title: 'Talk to us', body: 'We reply within 1 business day.' },
      {
        id: 's-contact-2',
        type: 'contact-info',
        title: 'Reach us',
        items: [
          { id: 'c1', title: 'WhatsApp', desc: '+254 700 000 000' },
          { id: 'c2', title: 'Email', desc: 'support@sokoflow.co.ke' },
          { id: 'c3', title: 'Office', desc: 'Nairobi, Kenya' },
        ],
      },
    ],
    metaTitle: 'Contact Us | SokoFlow Support',
    metaDescription:
      'Need help with your SokoFlow store or M-Pesa integration? Contact our Nairobi support team today.',
    template: 'Contact Split',
    system: true,
    revisions: [],
  },
  {
    id: 'page-faq',
    title: 'FAQ',
    slug: '/faq',
    type: 'faq',
    status: 'Draft',
    lastUpdated: 'Sep 22, 2026',
    author: 'Isaac Mutinda',
    content:
      'Find answers to common questions regarding M-Pesa STK push integration, WhatsApp webhook setup, and inventory sync.',
    sections: [
      { id: 's-faq-1', type: 'hero', title: 'Frequently asked questions', body: 'Everything you need to know about SokoFlow.' },
      {
        id: 's-faq-2',
        type: 'faq',
        title: 'General',
        items: [
          { id: 'q1', q: 'How do I connect WhatsApp?', a: 'Go to WhatsApp → Account, paste your Phone Number ID and token from Meta Business Suite, then save.' },
          { id: 'q2', q: 'Does M-Pesa STK work outside Kenya?', a: 'Currently we support Kenya (Safaricom). Tanzania and Uganda are on the roadmap.' },
          { id: 'q3', q: 'Can I try before paying?', a: 'Yes — every plan includes a 14-day free trial.' },
        ],
      },
    ],
    metaTitle: 'Frequently Asked Questions | SokoFlow Help',
    metaDescription: 'Got questions about SokoFlow? Browse our comprehensive FAQ section.',
    template: 'FAQ Accordion',
    system: true,
    revisions: [],
  },
  {
    id: 'page-terms',
    title: 'Terms & Conditions',
    slug: '/terms',
    type: 'legal',
    status: 'Published',
    lastUpdated: 'Aug 25, 2026',
    author: 'Legal Counsel',
    content:
      'By using SokoFlow services, merchants agree to transaction fees, API usage limits, and fair trading standards.',
    sections: [
      { id: 's-terms-1', type: 'richtext', title: '1. Agreement', body: 'By accessing SokoFlow you agree to these terms.' },
      { id: 's-terms-2', type: 'richtext', title: '2. Fees', body: 'Transaction fees are charged per successful M-Pesa payment.' },
      { id: 's-terms-3', type: 'richtext', title: '3. Acceptable use', body: 'No spam, no prohibited goods, no fraudulent transactions.' },
    ],
    metaTitle: 'Terms & Conditions | SokoFlow Merchant Agreement',
    metaDescription: 'Read the official terms of service for operating a SokoFlow storefront.',
    template: 'Legal Document',
    system: true,
    revisions: [],
  },
  {
    id: 'page-privacy',
    title: 'Privacy Policy',
    slug: '/privacy-policy',
    type: 'legal',
    status: 'Published',
    lastUpdated: 'Aug 28, 2026',
    author: 'Legal Counsel',
    content:
      'SokoFlow protects your personal data in compliance with the Data Protection Act of Kenya.',
    sections: [
      { id: 's-privacy-1', type: 'richtext', title: 'Data we collect', body: 'Phone numbers, order metadata, payment confirmations.' },
      { id: 's-privacy-2', type: 'richtext', title: 'How we use it', body: 'To fulfil orders, prevent fraud, and improve the product.' },
      { id: 's-privacy-3', type: 'richtext', title: 'Your rights', body: 'You may request export or deletion of your data at any time.' },
    ],
    metaTitle: 'Privacy Policy | SokoFlow Security',
    metaDescription: 'How we collect, use, and secure your merchant and buyer data.',
    template: 'Legal Document',
    system: true,
    revisions: [],
  },
  {
    id: 'page-shipping',
    title: 'Shipping Policy',
    slug: '/shipping-policy',
    type: 'legal',
    status: 'Published',
    lastUpdated: 'Sep 10, 2026',
    author: 'Admin Team',
    content:
      'We offer reliable countrywide delivery across Kenya through G4S and Fargo Courier, with same-day delivery in Nairobi CBD.',
    sections: [
      { id: 's-ship-1', type: 'richtext', title: 'Delivery partners', body: 'G4S, Fargo Courier, and SokoFlow Riders.' },
      { id: 's-ship-2', type: 'richtext', title: 'Timelines', body: 'Nairobi CBD: same-day. Countrywide: 1–3 business days.' },
    ],
    metaTitle: 'Shipping & Delivery Policy | SokoFlow',
    metaDescription: 'Review our delivery timelines, courier partners, and shipping rates across Kenya.',
    template: 'Legal Document',
    system: true,
    revisions: [],
  },
  {
    id: 'page-returns',
    title: 'Returns Policy',
    slug: '/return-policy',
    type: 'legal',
    status: 'Published',
    lastUpdated: 'Sep 05, 2026',
    author: 'Admin Team',
    content:
      'Items can be returned within 7 days of delivery if defective or incorrect. M-Pesa refunds are processed within 24 hours.',
    sections: [
      { id: 's-ret-1', type: 'richtext', title: 'Eligibility', body: 'Defective or incorrect items only, within 7 days.' },
      { id: 's-ret-2', type: 'richtext', title: 'Refunds', body: 'M-Pesa refunds are processed within 24 hours of approval.' },
    ],
    metaTitle: 'Returns & Refund Policy | SokoFlow',
    metaDescription: 'Read our 7-day return and instant M-Pesa refund guidelines.',
    template: 'Legal Document',
    system: true,
    revisions: [],
  },
];

const TEMPLATES = [
  'Landing Page',
  'Standard Layout',
  'Legal Document',
  'Contact Split',
  'FAQ Accordion',
  'Blank',
];

const PAGE_TYPE_LABELS: Record<PageType, string> = {
  home: 'Home',
  about: 'About',
  contact: 'Contact',
  faq: 'FAQ',
  legal: 'Legal / Policy',
  custom: 'Custom',
};

const SECTION_LABELS: Record<SectionType, string> = {
  hero: 'Hero banner',
  richtext: 'Rich text',
  faq: 'FAQ group',
  cta: 'Call to action',
  'contact-info': 'Contact info',
  features: 'Feature grid',
  team: 'Team members',
};

export default function CmsPagesPage() {
  const [pages, setPages] = useState<CmsPage[]>(INITIAL_PAGES);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'add' | 'edit'>('add');
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);

  const [listSearch, setListSearch] = useState('');
  const [listTypeFilter, setListTypeFilter] = useState<string>('All');
  const [listStatusFilter, setListStatusFilter] = useState<string>('All');

  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formType, setFormType] = useState<PageType>('custom');
  const [formStatus, setFormStatus] = useState<PageStatus>('Draft');
  const [formContent, setFormContent] = useState('');
  const [formSections, setFormSections] = useState<PageSection[]>([]);
  const [formMetaTitle, setFormMetaTitle] = useState('');
  const [formMetaDescription, setFormMetaDescription] = useState('');
  const [formTemplate, setFormTemplate] = useState('Standard Layout');
  const [formSystem, setFormSystem] = useState(false);
  const [formRevisions, setFormRevisions] = useState<PageRevision[]>([]);

  const [editorTab, setEditorTab] = useState<'content' | 'sections' | 'seo' | 'revisions'>('content');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [newSectionType, setNewSectionType] = useState<SectionType>('richtext');

  const [pageToDelete, setPageToDelete] = useState<CmsPage | null>(null);

  const anyOverlayOpen = isEditorOpen || pageToDelete !== null;

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (!anyOverlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddSectionOpen) setIsAddSectionOpen(false);
        else if (isPreviewOpen) setIsPreviewOpen(false);
        else if (pageToDelete) setPageToDelete(null);
        else if (isEditorOpen) setIsEditorOpen(false);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [anyOverlayOpen, isAddSectionOpen, isPreviewOpen, pageToDelete, isEditorOpen]);

  const toast = (msg: string) => setToastMessage(msg);

  const filteredPages = useMemo(() => {
    return pages.filter((p) => {
      const matchesType = listTypeFilter === 'All' || p.type === listTypeFilter;
      const matchesStatus = listStatusFilter === 'All' || p.status === listStatusFilter;
      const q = listSearch.toLowerCase();
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.metaTitle || '').toLowerCase().includes(q);
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [pages, listTypeFilter, listStatusFilter, listSearch]);

  const openAdd = () => {
    setEditorMode('add');
    setCurrentPageId(null);
    setFormTitle('');
    setFormSlug('');
    setFormType('custom');
    setFormStatus('Draft');
    setFormContent('');
    setFormSections([]);
    setFormMetaTitle('');
    setFormMetaDescription('');
    setFormTemplate('Standard Layout');
    setFormSystem(false);
    setFormRevisions([]);
    setEditorTab('content');
    setIsEditorOpen(true);
  };

  const openEdit = (page: CmsPage) => {
    setEditorMode('edit');
    setCurrentPageId(page.id);
    setFormTitle(page.title);
    setFormSlug(page.slug);
    setFormType(page.type);
    setFormStatus(page.status);
    setFormContent(page.content);
    setFormSections(page.sections || []);
    setFormMetaTitle(page.metaTitle || '');
    setFormMetaDescription(page.metaDescription || '');
    setFormTemplate(page.template || 'Standard Layout');
    setFormSystem(page.system);
    setFormRevisions(page.revisions || []);
    setEditorTab('content');
    setIsEditorOpen(true);
  };

  const savePage = (statusToSet?: PageStatus) => {
    if (!formTitle.trim()) {
      toast('Page title is required');
      return;
    }
    const finalStatus = statusToSet || formStatus;
    const revision: PageRevision = {
      id: `rev-${Date.now()}`,
      savedAt: 'Just now',
      author: 'Admin',
      title: formTitle,
      content: formContent,
      note: statusToSet ? `Saved as ${statusToSet}` : 'Manual save',
    };

    if (editorMode === 'add') {
      const newPage: CmsPage = {
        id: `page-${Date.now()}`,
        title: formTitle,
        slug: formSlug || `/${formTitle.toLowerCase().replace(/\s+/g, '-')}`,
        type: formType,
        status: finalStatus,
        lastUpdated: 'Today',
        author: 'Admin',
        content: formContent,
        sections: formSections,
        metaTitle: formMetaTitle,
        metaDescription: formMetaDescription,
        template: formTemplate,
        system: false,
        revisions: [revision],
      };
      setPages([newPage, ...pages]);
      toast(`Page created as ${finalStatus.toLowerCase()}`);
    } else {
      setPages((prev) =>
        prev.map((p) =>
          p.id === currentPageId
            ? {
              ...p,
              title: formTitle,
              slug: formSlug,
              type: formType,
              status: finalStatus,
              lastUpdated: 'Today',
              content: formContent,
              sections: formSections,
              metaTitle: formMetaTitle,
              metaDescription: formMetaDescription,
              template: formTemplate,
              revisions: [revision, ...(p.revisions || [])].slice(0, 10),
            }
            : p
        )
      );
      setFormRevisions((prev) => [revision, ...prev].slice(0, 10));
      toast('Page updated');
    }
    setIsEditorOpen(false);
  };

  const restoreRevision = (rev: PageRevision) => {
    setFormTitle(rev.title);
    setFormContent(rev.content);
    toast(`Restored revision from ${rev.savedAt}`);
  };

  const confirmDelete = () => {
    if (!pageToDelete) return;
    if (pageToDelete.system) {
      toast('System pages cannot be deleted');
      setPageToDelete(null);
      return;
    }
    setPages((prev) => prev.filter((p) => p.id !== pageToDelete.id));
    setPageToDelete(null);
    toast('Page deleted');
  };

  const insertFormatting = (tag: string) => {
    setFormContent((prev) => prev + ` [${tag}] `);
    toast(`Inserted ${tag} block`);
  };

  const addSection = () => {
    const s: PageSection = {
      id: `sec-${Date.now()}`,
      type: newSectionType,
      title: '',
      body: '',
      items: [],
    };
    setFormSections((prev) => [...prev, s]);
    setIsAddSectionOpen(false);
    toast(`${SECTION_LABELS[newSectionType]} added`);
  };

  const updateSection = (id: string, patch: Partial<PageSection>) => {
    setFormSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeSection = (id: string) => {
    setFormSections((prev) => prev.filter((s) => s.id !== id));
    toast('Section removed');
  };

  const moveSection = (id: string, dir: -1 | 1) => {
    setFormSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  };

  const addFaqItem = (sectionId: string) => {
    setFormSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, items: [...(s.items || []), { id: `it-${Date.now()}`, q: '', a: '' }] }
          : s
      )
    );
  };

  const updateItem = (
    sectionId: string,
    itemId: string,
    patch: Partial<{ q: string; a: string; title: string; desc: string }>
  ) => {
    setFormSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
            ...s,
            items: (s.items || []).map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
          }
          : s
      )
    );
  };

  const removeItem = (sectionId: string, itemId: string) => {
    setFormSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, items: (s.items || []).filter((it) => it.id !== itemId) }
          : s
      )
    );
  };

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

      {!isEditorOpen && (
        <>
          <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
            <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-[15px] font-semibold text-slate-900">Pages</h1>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Manage static content — Home, About, Contact, FAQ, Terms, Privacy, Shipping, Returns
                </p>
              </div>
              <button
                onClick={openAdd}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add page
              </button>
            </div>
          </header>

          <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
              <div className="bg-slate-100 p-0.5 rounded-sm inline-flex gap-0.5 overflow-x-auto">
                {(['All', 'home', 'about', 'contact', 'faq', 'legal', 'custom'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setListTypeFilter(t)}
                    className={`px-3 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${listTypeFilter === t ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600 hover:bg-white/60'
                      }`}
                  >
                    {t === 'All' ? 'All types' : PAGE_TYPE_LABELS[t as PageType]}
                  </button>
                ))}
              </div>

              <div className="bg-slate-100 p-0.5 rounded-sm inline-flex gap-0.5 overflow-x-auto">
                {(['All', 'Published', 'Draft'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setListStatusFilter(s)}
                    className={`px-3 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${listStatusFilter === s ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600 hover:bg-white/60'
                      }`}
                  >
                    {s === 'All' ? 'All status' : s}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 lg:max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search pages…"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <p className="text-[13px] font-medium text-slate-700">
                  Static content · {filteredPages.length}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-3 font-medium">Title</th>
                      <th className="py-2 px-3 font-medium">Slug</th>
                      <th className="py-2 px-3 font-medium">Type</th>
                      <th className="py-2 px-3 font-medium">Status</th>
                      <th className="py-2 px-3 font-medium">Last updated</th>
                      <th className="py-2 px-3 font-medium">Author</th>
                      <th className="py-2 px-3 w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPages.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 text-[13px]">
                          No pages match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredPages.map((page) => (
                        <tr
                          key={page.id}
                          onClick={() => openEdit(page)}
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <td className="py-2 px-3 font-medium text-slate-900">
                            <span className="inline-flex items-center gap-1.5">
                              {page.title}
                              {page.system && <Lock className="w-3 h-3 text-slate-400" />}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">{page.slug}</td>
                          <td className="py-2 px-3">
                            <span className="inline-block px-2 py-0.5 rounded-sm text-[13px] bg-slate-100 text-slate-600 border border-slate-200">
                              {PAGE_TYPE_LABELS[page.type]}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${page.status === 'Published'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : 'bg-amber-50 text-amber-700 border-amber-100'
                                }`}
                            >
                              {page.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-500 font-mono">{page.lastUpdated}</td>
                          <td className="py-2 px-3 text-slate-700">{page.author}</td>
                          <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEdit(page)}
                                title="Edit"
                                className="p-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setPageToDelete(page)}
                                title={page.system ? 'System pages cannot be deleted' : 'Delete'}
                                disabled={page.system}
                                className="p-2 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
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
        </>
      )}

      {isEditorOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col">
          <div className="bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between shrink-0 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setIsEditorOpen(false)}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-2 rounded-sm text-[13px] shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
              <span className="w-px h-5 bg-slate-200 shrink-0" />
              <input
                type="text"
                placeholder="Page title"
                value={formTitle}
                onChange={(e) => {
                  setFormTitle(e.target.value);
                  if (editorMode === 'add') {
                    setFormSlug(`/${e.target.value.toLowerCase().replace(/\s+/g, '-')}`);
                  }
                }}
                className="text-[15px] font-semibold text-slate-900 bg-transparent focus:outline-none min-w-0 flex-1"
              />
              {formSystem && (
                <span className="inline-flex items-center gap-1 text-[13px] font-medium bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-sm shrink-0">
                  <Lock className="w-3 h-3" />
                  System
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsPreviewOpen(true)}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-2 rounded-sm text-[13px]"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Preview</span>
              </button>
              <button
                onClick={() => savePage('Draft')}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-2 rounded-sm text-[13px]"
              >
                <Save className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save draft</span>
              </button>
              <button
                onClick={() => savePage('Published')}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
              >
                <Send className="w-3.5 h-3.5" />
                Publish
              </button>
            </div>
          </div>

          <div className="bg-white border-b border-slate-200 px-3 flex items-center gap-0.5 overflow-x-auto shrink-0">
            {(['content', 'sections', 'seo', 'revisions'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setEditorTab(t)}
                className={`px-3 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap border-b-2 -mb-px ${editorTab === t
                    ? 'text-blue-950 border-blue-950'
                    : 'text-slate-600 border-transparent hover:text-slate-900'
                  }`}
              >
                {t === 'content' && 'Content'}
                {t === 'sections' && `Sections (${formSections.length})`}
                {t === 'seo' && 'SEO'}
                {t === 'revisions' && `Revisions (${formRevisions.length})`}
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 flex flex-col bg-white border-r border-slate-200 overflow-hidden">
              {editorTab === 'content' && (
                <>
                  <div className="bg-slate-50 border-b border-slate-200 p-1.5 flex flex-wrap items-center gap-0.5 shrink-0">
                    <ToolBtn icon={Bold} onClick={() => insertFormatting('bold')} label="Bold" />
                    <ToolBtn icon={Italic} onClick={() => insertFormatting('italic')} label="Italic" />
                    <span className="w-px h-4 bg-slate-200 mx-1" />
                    <ToolBtn icon={Heading} onClick={() => insertFormatting('h1')} label="Heading" />
                    <ToolBtn icon={List} onClick={() => insertFormatting('list')} label="List" />
                    <ToolBtn icon={LinkIcon} onClick={() => insertFormatting('link')} label="Link" />
                    <ToolBtn icon={ImageIcon} onClick={() => insertFormatting('image')} label="Image" />
                    <ToolBtn icon={Code} onClick={() => insertFormatting('code')} label="Code" />
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                    <textarea
                      placeholder="Write your page content here…"
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      className="w-full h-full min-h-[400px] bg-transparent border-none text-[13px] text-slate-900 focus:outline-none resize-none leading-relaxed font-mono"
                    />
                  </div>
                </>
              )}

              {editorTab === 'sections' && (
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium text-slate-700">
                      Content sections — stack blocks to build the page
                    </p>
                    <button
                      onClick={() => setIsAddSectionOpen(true)}
                      className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-2 rounded-sm text-[13px]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add section
                    </button>
                  </div>

                  {formSections.length === 0 ? (
                    <div className="border border-dashed border-slate-200 rounded-sm p-6 text-center text-slate-400 text-[13px]">
                      No sections yet. Add a hero, rich text block, FAQ group, or CTA.
                    </div>
                  ) : (
                    formSections.map((s, i) => (
                      <div key={s.id} className="border border-slate-200 rounded-sm bg-white">
                        <div className="px-2 py-1.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-block px-2 py-0.5 rounded-sm text-[13px] bg-white border border-slate-200 text-slate-600 shrink-0">
                              {SECTION_LABELS[s.type]}
                            </span>
                            <span className="text-[13px] text-slate-400 font-mono truncate">#{i + 1}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => moveSection(s.id, -1)}
                              disabled={i === 0}
                              className="p-1.5 rounded-sm hover:bg-slate-200 text-slate-600 disabled:opacity-30"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => moveSection(s.id, 1)}
                              disabled={i === formSections.length - 1}
                              className="p-1.5 rounded-sm hover:bg-slate-200 text-slate-600 disabled:opacity-30"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => removeSection(s.id)}
                              className="p-1.5 rounded-sm hover:bg-red-50 text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="p-2 space-y-2 text-[13px]">
                          <div>
                            <label className="block font-medium text-slate-700 mb-1">Title</label>
                            <input
                              type="text"
                              value={s.title || ''}
                              onChange={(e) => updateSection(s.id, { title: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                            />
                          </div>
                          <div>
                            <label className="block font-medium text-slate-700 mb-1">Body</label>
                            <textarea
                              rows={3}
                              value={s.body || ''}
                              onChange={(e) => updateSection(s.id, { body: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                            />
                          </div>

                          {(s.type === 'cta' || s.type === 'hero') && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block font-medium text-slate-700 mb-1">Button label</label>
                                <input
                                  type="text"
                                  value={s.ctaLabel || ''}
                                  onChange={(e) => updateSection(s.id, { ctaLabel: e.target.value })}
                                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                                />
                              </div>
                              <div>
                                <label className="block font-medium text-slate-700 mb-1">Button link</label>
                                <input
                                  type="text"
                                  value={s.ctaHref || ''}
                                  onChange={(e) => updateSection(s.id, { ctaHref: e.target.value })}
                                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
                                />
                              </div>
                            </div>
                          )}

                          {(s.type === 'faq' ||
                            s.type === 'features' ||
                            s.type === 'team' ||
                            s.type === 'contact-info') && (
                              <div className="pt-1 border-t border-slate-100 space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-[13px] font-medium text-slate-600">
                                    Items ({s.items?.length || 0})
                                  </p>
                                  <button
                                    onClick={() => addFaqItem(s.id)}
                                    className="text-[13px] text-blue-950 font-medium hover:underline inline-flex items-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" />
                                    Add item
                                  </button>
                                </div>
                                {(s.items || []).map((it) => (
                                  <div key={it.id} className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-1.5">
                                    {s.type === 'faq' ? (
                                      <>
                                        <input
                                          type="text"
                                          placeholder="Question"
                                          value={it.q || ''}
                                          onChange={(e) => updateItem(s.id, it.id, { q: e.target.value })}
                                          className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                                        />
                                        <textarea
                                          rows={2}
                                          placeholder="Answer"
                                          value={it.a || ''}
                                          onChange={(e) => updateItem(s.id, it.id, { a: e.target.value })}
                                          className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                                        />
                                      </>
                                    ) : (
                                      <>
                                        <input
                                          type="text"
                                          placeholder="Title"
                                          value={it.title || ''}
                                          onChange={(e) => updateItem(s.id, it.id, { title: e.target.value })}
                                          className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                                        />
                                        <input
                                          type="text"
                                          placeholder="Description"
                                          value={it.desc || ''}
                                          onChange={(e) => updateItem(s.id, it.id, { desc: e.target.value })}
                                          className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                                        />
                                      </>
                                    )}
                                    <div className="flex justify-end">
                                      <button
                                        onClick={() => removeItem(s.id, it.id)}
                                        className="text-[13px] text-red-600 hover:underline"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {editorTab === 'seo' && (
                <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
                  <div className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                    <p className="font-medium text-slate-900 border-b border-slate-100 pb-2 inline-flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-blue-950" />
                      Search engine metadata
                    </p>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Meta title</label>
                      <input
                        type="text"
                        placeholder="SEO title"
                        value={formMetaTitle}
                        onChange={(e) => setFormMetaTitle(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                      />
                      <p className="text-[13px] text-slate-400 mt-1">
                        {formMetaTitle.length}/60 characters recommended
                      </p>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Meta description</label>
                      <textarea
                        rows={3}
                        placeholder="Brief summary for search results…"
                        value={formMetaDescription}
                        onChange={(e) => setFormMetaDescription(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                      />
                      <p className="text-[13px] text-slate-400 mt-1">
                        {formMetaDescription.length}/160 characters recommended
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-sm p-3 space-y-1">
                    <p className="text-[13px] font-medium text-slate-500 mb-2">Google preview</p>
                    <p className="text-[13px] text-slate-500 font-mono truncate">
                      https://sokoflow.co.ke{formSlug || '/'}
                    </p>
                    <p className="text-[15px] text-blue-900 font-medium truncate">
                      {formMetaTitle || formTitle || 'Untitled page'}
                    </p>
                    <p className="text-[13px] text-slate-600 line-clamp-2">
                      {formMetaDescription ||
                        'No description set — search engines will pick content from the page body.'}
                    </p>
                  </div>
                </div>
              )}

              {editorTab === 'revisions' && (
                <div className="flex-1 overflow-y-auto p-3 space-y-2 text-[13px]">
                  {formRevisions.length === 0 ? (
                    <div className="border border-dashed border-slate-200 rounded-sm p-6 text-center text-slate-400 text-[13px]">
                      No revisions yet. Every save will be recorded here.
                    </div>
                  ) : (
                    formRevisions.map((r) => (
                      <div key={r.id} className="border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{r.title}</p>
                          <p className="text-[13px] text-slate-500 font-mono">
                            {r.savedAt} · {r.author}
                          </p>
                          {r.note && <p className="text-[13px] text-slate-500 mt-0.5">{r.note}</p>}
                        </div>
                        <button
                          onClick={() => restoreRevision(r)}
                          className="shrink-0 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-1.5 rounded-sm text-[13px]"
                        >
                          Restore
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <aside className="w-full lg:w-80 bg-slate-50 p-3 overflow-y-auto space-y-3 text-[13px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200">
              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
                <p className="font-medium text-slate-900 border-b border-slate-100 pb-2">Publishing</p>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as PageStatus)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  >
                    <option value="Published">Published</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Page type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as PageType)}
                    disabled={formSystem}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60"
                  >
                    {Object.entries(PAGE_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">URL slug</label>
                  <input
                    type="text"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    disabled={formSystem}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60"
                  />
                  {formSystem && (
                    <p className="text-[13px] text-slate-400 mt-1">System page — slug is locked</p>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Template</label>
                  <select
                    value={formTemplate}
                    onChange={(e) => setFormTemplate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  >
                    {TEMPLATES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-1 text-[13px]">
                <p className="font-medium text-slate-700">Summary</p>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Words</span>
                  <span className="font-medium text-slate-900">
                    {formContent.split(/\s+/).filter(Boolean).length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Characters</span>
                  <span className="font-medium text-slate-900">{formContent.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Sections</span>
                  <span className="font-medium text-slate-900">{formSections.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Revisions</span>
                  <span className="font-medium text-slate-900">{formRevisions.length}</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {isAddSectionOpen && (
        <div
          className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setIsAddSectionOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl space-y-3 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-slate-900">Add section</h3>
              <button
                onClick={() => setIsAddSectionOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(SECTION_LABELS) as SectionType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setNewSectionType(t)}
                  className={`text-left p-2 rounded-sm border text-[13px] transition ${newSectionType === t
                      ? 'bg-blue-50 border-blue-200 text-blue-950'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  <p className="font-medium">{SECTION_LABELS[t]}</p>
                  <p className="text-slate-400 mt-0.5 font-mono">{t}</p>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setIsAddSectionOpen(false)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={addSection}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Add section
              </button>
            </div>
          </div>
        </div>
      )}

      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-3xl w-full max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900">Live preview</h3>
                <p className="text-[13px] text-slate-500 font-mono">sokoflow.co.ke{formSlug || '/'}</p>
              </div>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {formSections.length > 0 ? (
                formSections.map((s) => (
                  <div key={s.id} className="border-b border-slate-100 pb-4 last:border-0">
                    <p className="text-[13px] text-slate-400 font-mono uppercase mb-2">
                      {SECTION_LABELS[s.type]}
                    </p>
                    {s.title && (
                      <h2 className="text-[15px] font-semibold text-slate-900 mb-1">{s.title}</h2>
                    )}
                    {s.body && <p className="text-[13px] text-slate-600 leading-relaxed">{s.body}</p>}
                    {s.items && s.items.length > 0 && (
                      <ul className="mt-2 space-y-1 text-[13px]">
                        {s.items.map((it) => (
                          <li key={it.id} className="text-slate-700">
                            {it.q ? <span className="font-medium">{it.q}: </span> : null}
                            {it.title ? <span className="font-medium">{it.title} — </span> : null}
                            {it.a || it.desc}
                          </li>
                        ))}
                      </ul>
                    )}
                    {(s.ctaLabel || s.ctaHref) && (
                      <button className="mt-2 bg-blue-950 text-white text-[13px] font-medium px-3 py-2 rounded-sm">
                        {s.ctaLabel || 'Learn more'}
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div>
                  <h1 className="text-[15px] font-semibold text-slate-900 mb-2">{formTitle}</h1>
                  <p className="text-[13px] text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {formContent}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {pageToDelete && (
        <div
          className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setPageToDelete(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl text-center space-y-3 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-sm bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Delete page?</h3>
              <p className="text-slate-500 mt-1">
                Remove <span className="font-medium text-slate-800">"{pageToDelete.title}"</span>? This
                cannot be undone.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => setPageToDelete(null)}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-sm text-[13px]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolBtn({
  icon: Icon,
  onClick,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="p-2 rounded-sm hover:bg-slate-200 text-slate-700 transition"
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
