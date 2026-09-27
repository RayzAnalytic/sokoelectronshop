'use client';

import React, { useEffect, useState } from 'react';
import {
  Plus,
  CheckCircle2,
  X,
  Trash2,
  Edit3,
  ArrowLeft,
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
} from 'lucide-react';

// --- TYPES ---
type PageStatus = 'Published' | 'Draft';

interface CmsPage {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  lastUpdated: string;
  author: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
  template?: string;
}

const INITIAL_PAGES: CmsPage[] = [
  {
    id: 'page-1',
    title: 'About Us',
    slug: '/about',
    status: 'Published',
    lastUpdated: 'Sep 20, 2026',
    author: 'Isaac Mutinda',
    content:
      'Welcome to SokoFlow, Kenya\u2019s premier conversational commerce platform connecting WhatsApp businesses with M-Pesa automated payments.',
    metaTitle: 'About SokoFlow | Conversational Commerce Kenya',
    metaDescription:
      'Learn about SokoFlow\u2019s mission to empower African merchants with automated WhatsApp and M-Pesa storefronts.',
    template: 'Standard Layout',
  },
  {
    id: 'page-2',
    title: 'Contact',
    slug: '/contact',
    status: 'Published',
    lastUpdated: 'Sep 18, 2026',
    author: 'Isaac Mutinda',
    content:
      'Get in touch with our support and engineering team in Nairobi, Kenya. Reach us via WhatsApp or email at support@sokoflow.co.ke.',
    metaTitle: 'Contact Us | SokoFlow Support',
    metaDescription:
      'Need help with your SokoFlow store or M-Pesa integration? Contact our Nairobi support team today.',
    template: 'Contact Split',
  },
  {
    id: 'page-3',
    title: 'Shipping Policy',
    slug: '/shipping-policy',
    status: 'Published',
    lastUpdated: 'Sep 10, 2026',
    author: 'Admin Team',
    content:
      'We offer reliable countrywide delivery across Kenya through G4S and Fargo Courier, with same-day delivery in Nairobi CBD.',
    metaTitle: 'Shipping & Delivery Policy | SokoFlow',
    metaDescription:
      'Review our delivery timelines, courier partners, and shipping rates across Kenya.',
    template: 'Legal Document',
  },
  {
    id: 'page-4',
    title: 'Return Policy',
    slug: '/return-policy',
    status: 'Published',
    lastUpdated: 'Sep 05, 2026',
    author: 'Admin Team',
    content:
      'Items can be returned within 7 days of delivery if defective or incorrect. M-Pesa refunds are processed within 24 hours.',
    metaTitle: 'Returns & Refund Policy | SokoFlow',
    metaDescription: 'Read our 7-day return and instant M-Pesa refund guidelines.',
    template: 'Legal Document',
  },
  {
    id: 'page-5',
    title: 'Privacy Policy',
    slug: '/privacy-policy',
    status: 'Published',
    lastUpdated: 'Aug 28, 2026',
    author: 'Legal Counsel',
    content:
      'SokoFlow protects your personal data in compliance with the Data Protection Act of Kenya. We never share customer phone numbers or payment logs.',
    metaTitle: 'Privacy Policy | SokoFlow Security',
    metaDescription: 'How we collect, use, and secure your merchant and buyer data.',
    template: 'Legal Document',
  },
  {
    id: 'page-6',
    title: 'Terms & Conditions',
    slug: '/terms',
    status: 'Published',
    lastUpdated: 'Aug 25, 2026',
    author: 'Legal Counsel',
    content:
      'By using SokoFlow services, merchants agree to transaction fees, API usage limits, and fair trading standards.',
    metaTitle: 'Terms & Conditions | SokoFlow Merchant Agreement',
    metaDescription: 'Read the official terms of service for operating a SokoFlow storefront.',
    template: 'Legal Document',
  },
  {
    id: 'page-7',
    title: 'FAQ',
    slug: '/faq',
    status: 'Draft',
    lastUpdated: 'Sep 22, 2026',
    author: 'Isaac Mutinda',
    content:
      'Find answers to common questions regarding M-Pesa STK push integration, WhatsApp webhook setup, and inventory sync.',
    metaTitle: 'Frequently Asked Questions | SokoFlow Help',
    metaDescription: 'Got questions about SokoFlow? Browse our comprehensive FAQ section.',
    template: 'FAQ Accordion',
  },
];

const TEMPLATES = ['Standard Layout', 'Legal Document', 'Contact Split', 'FAQ Accordion'];

export default function CmsPagesPage() {
  const [pages, setPages] = useState<CmsPage[]>(INITIAL_PAGES);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'add' | 'edit'>('add');
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formStatus, setFormStatus] = useState<PageStatus>('Draft');
  const [formContent, setFormContent] = useState('');
  const [formMetaTitle, setFormMetaTitle] = useState('');
  const [formMetaDescription, setFormMetaDescription] = useState('');
  const [formTemplate, setFormTemplate] = useState('Standard Layout');

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
        if (pageToDelete) setPageToDelete(null);
        else if (isEditorOpen) setIsEditorOpen(false);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [anyOverlayOpen, pageToDelete, isEditorOpen]);

  const toast = (msg: string) => setToastMessage(msg);

  const openAdd = () => {
    setEditorMode('add');
    setCurrentPageId(null);
    setFormTitle('');
    setFormSlug('');
    setFormStatus('Draft');
    setFormContent('');
    setFormMetaTitle('');
    setFormMetaDescription('');
    setFormTemplate('Standard Layout');
    setIsEditorOpen(true);
  };

  const openEdit = (page: CmsPage) => {
    setEditorMode('edit');
    setCurrentPageId(page.id);
    setFormTitle(page.title);
    setFormSlug(page.slug);
    setFormStatus(page.status);
    setFormContent(page.content);
    setFormMetaTitle(page.metaTitle || '');
    setFormMetaDescription(page.metaDescription || '');
    setFormTemplate(page.template || 'Standard Layout');
    setIsEditorOpen(true);
  };

  const savePage = (statusToSet?: PageStatus) => {
    if (!formTitle.trim()) {
      toast('Page title is required');
      return;
    }
    const finalStatus = statusToSet || formStatus;

    if (editorMode === 'add') {
      const newPage: CmsPage = {
        id: `page-${Date.now()}`,
        title: formTitle,
        slug: formSlug || `/${formTitle.toLowerCase().replace(/\s+/g, '-')}`,
        status: finalStatus,
        lastUpdated: 'Today',
        author: 'Admin',
        content: formContent,
        metaTitle: formMetaTitle,
        metaDescription: formMetaDescription,
        template: formTemplate,
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
                status: finalStatus,
                lastUpdated: 'Today',
                content: formContent,
                metaTitle: formMetaTitle,
                metaDescription: formMetaDescription,
                template: formTemplate,
              }
            : p
        )
      );
      toast('Page updated');
    }
    setIsEditorOpen(false);
  };

  const confirmDelete = () => {
    if (!pageToDelete) return;
    setPages((prev) => prev.filter((p) => p.id !== pageToDelete.id));
    setPageToDelete(null);
    toast('Page deleted');
  };

  const insertFormatting = (tag: string) => {
    setFormContent((prev) => prev + ` [${tag}] `);
    toast(`Inserted ${tag} block`);
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

      {/* ─────────── LIST VIEW ─────────── */}
      {!isEditorOpen && (
        <>
          <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
            <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-[15px] font-semibold text-slate-900">Pages</h1>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Manage static content — About, Contact, Policies, FAQ
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
            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <p className="text-[13px] font-medium text-slate-700">
                  Static content · {pages.length}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-3 font-medium">Title</th>
                      <th className="py-2 px-3 font-medium">Slug</th>
                      <th className="py-2 px-3 font-medium">Status</th>
                      <th className="py-2 px-3 font-medium">Last updated</th>
                      <th className="py-2 px-3 font-medium">Author</th>
                      <th className="py-2 px-3 w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pages.map((page) => (
                      <tr
                        key={page.id}
                        onClick={() => openEdit(page)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {page.title}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600">
                          {page.slug}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${
                              page.status === 'Published'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}
                          >
                            {page.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-500 font-mono">
                          {page.lastUpdated}
                        </td>
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
                              title="Delete"
                              className="p-2 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </>
      )}

      {/* ─────────── FULL-SCREEN EDITOR ─────────── */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col">

          {/* Top bar */}
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
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => toast('Opening live preview')}
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

          {/* Body */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

            {/* LEFT — editor */}
            <div className="flex-1 flex flex-col bg-white border-r border-slate-200 overflow-hidden">
              {/* Toolbar */}
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

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-3">
                <textarea
                  placeholder="Write your page content here…"
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full h-full min-h-[400px] bg-transparent border-none text-[13px] text-slate-900 focus:outline-none resize-none leading-relaxed font-mono"
                />
              </div>
            </div>

            {/* RIGHT — sidebar */}
            <aside className="w-full lg:w-80 bg-slate-50 p-3 overflow-y-auto space-y-3 text-[13px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200">

              {/* Publishing */}
              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
                <p className="font-medium text-slate-900 border-b border-slate-100 pb-2">
                  Publishing
                </p>

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
                  <label className="block font-medium text-slate-700 mb-1">URL slug</label>
                  <input
                    type="text"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
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

              {/* SEO */}
              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
                <p className="font-medium text-slate-900 border-b border-slate-100 pb-2 inline-flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-950" />
                  SEO
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
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Meta description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Brief summary for search results…"
                    value={formMetaDescription}
                    onChange={(e) => setFormMetaDescription(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                </div>
              </div>

              {/* Summary */}
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
                  <span className="text-slate-500">Last updated</span>
                  <span className="font-medium text-slate-900">Today</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
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
                Remove{' '}
                <span className="font-medium text-slate-800">"{pageToDelete.title}"</span>? This
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

/* ---------- Toolbar button ---------- */
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
