'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
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
  Search,
  Bold,
  Italic,
  Heading,
  List,
  Link as LinkIcon,
  Image as ImageIcon,
  Video,
  Code,
  AlertCircle,
  Upload,
  TrendingUp,
} from 'lucide-react';

// --- TYPES ---
type BlogPostStatus = 'Published' | 'Draft' | 'Scheduled';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  author: string;
  category: string;
  tags: string[];
  status: BlogPostStatus;
  views: number;
  publishDate: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
}

const INITIAL_POSTS: BlogPost[] = [
  {
    id: 'post-1',
    title: 'How to Automate M-Pesa STK Push for WhatsApp Businesses',
    slug: '/blog/automate-mpesa-stk-push-whatsapp',
    excerpt:
      'Discover how SokoFlow connects WhatsApp conversational commerce webhook APIs with Safaricom M-Pesa automated payment prompts.',
    coverImage: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80',
    author: 'Isaac Mutinda',
    category: 'Payments',
    tags: ['M-Pesa', 'WhatsApp', 'Automation', 'API'],
    status: 'Published',
    views: 3420,
    publishDate: 'Sep 20, 2026',
    content:
      'Automating M-Pesa STK push for WhatsApp orders allows merchants to close sales instantly without manual transaction code verification…',
    metaTitle: 'How to Automate M-Pesa STK Push | SokoFlow Guide',
    metaDescription:
      'Step-by-step tutorial on integrating Safaricom M-Pesa STK push into WhatsApp store checkouts.',
  },
  {
    id: 'post-2',
    title: 'Building Multi-Tenant SaaS Architectures with Django & Next.js',
    slug: '/blog/multi-tenant-saas-django-nextjs',
    excerpt:
      'An engineering deep dive into separating merchant storefront databases and managing role-based access control.',
    coverImage: 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=800&q=80',
    author: 'Isaac Mutinda',
    category: 'Engineering',
    tags: ['Django', 'Next.js', 'SaaS', 'PostgreSQL'],
    status: 'Published',
    views: 1890,
    publishDate: 'Sep 15, 2026',
    content:
      'Multi-tenancy requires careful consideration of tenant schema routing, connection pooling, and JWT authentication layers…',
    metaTitle: 'Building Multi-Tenant SaaS with Django & Next.js',
    metaDescription: 'Explore architectural patterns for multi-tenant web applications.',
  },
  {
    id: 'post-3',
    title: 'Top 10 Conversational Commerce Trends in Kenya for 2027',
    slug: '/blog/conversational-commerce-trends-kenya-2027',
    excerpt:
      'How Kenyan retail businesses are leveraging WhatsApp catalogues, chatbots, and instant mobile money transfers.',
    coverImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
    author: 'Brenda Akinyi',
    category: 'Retail & E-commerce',
    tags: ['Retail', 'WhatsApp', 'Kenya', 'Trends'],
    status: 'Published',
    views: 4120,
    publishDate: 'Sep 10, 2026',
    content:
      'Conversational commerce has shifted from simple chat inquiries to complete end-to-end purchasing journeys…',
    metaTitle: 'Top Conversational Commerce Trends in Kenya',
    metaDescription:
      'Analysis of WhatsApp business growth and mobile payments in East Africa.',
  },
  {
    id: 'post-4',
    title: 'Optimizing Tailwind CSS and Next.js Performance for Mobile Shoppers',
    slug: '/blog/optimizing-tailwind-nextjs-mobile',
    excerpt:
      'Tips and tricks for reducing First Contentful Paint and improving mobile storefront conversion rates.',
    coverImage: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80',
    author: 'Isaac Mutinda',
    category: 'Engineering',
    tags: ['Next.js', 'Tailwind', 'Performance', 'Mobile'],
    status: 'Draft',
    views: 0,
    publishDate: 'Sep 23, 2026',
    content:
      'Mobile shoppers expect sub-second load times. Image optimization and code splitting are critical…',
    metaTitle: 'Optimizing Tailwind & Next.js for Mobile',
    metaDescription: 'Performance guidelines for modern web storefronts.',
  },
  {
    id: 'post-5',
    title: 'Safaricom Daraja API v2: What Developers Need to Know',
    slug: '/blog/safaricom-daraja-api-v2-developer-guide',
    excerpt:
      'A comprehensive review of authentication token endpoints, timeout handling, and callback URL security.',
    coverImage: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80',
    author: 'Brian Kipkorir',
    category: 'Payments',
    tags: ['Daraja', 'M-Pesa', 'API', 'Security'],
    status: 'Scheduled',
    views: 0,
    publishDate: 'Oct 01, 2026',
    content:
      'Daraja API v2 introduces enhanced security protocols and streamlined sandbox testing environments…',
    metaTitle: 'Safaricom Daraja API v2 Developer Guide',
    metaDescription: 'Technical overview of Safaricom Daraja API integration.',
  },
];

const CATEGORIES = ['Payments', 'Engineering', 'Retail & E-commerce', 'Company News'];
const AUTHORS = ['Isaac Mutinda', 'Brenda Akinyi', 'Brian Kipkorir'];
const STATUSES: BlogPostStatus[] = ['Published', 'Draft', 'Scheduled'];

export default function BlogAdminPage() {
  const [posts, setPosts] = useState<BlogPost[]>(INITIAL_POSTS);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [authorFilter, setAuthorFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'add' | 'edit'>('add');
  const [currentPostId, setCurrentPostId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formExcerpt, setFormExcerpt] = useState('');
  const [formCoverImage, setFormCoverImage] = useState(
    'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80'
  );
  const [formCategory, setFormCategory] = useState('Payments');
  const [formTags, setFormTags] = useState('M-Pesa, WhatsApp, API');
  const [formAuthor, setFormAuthor] = useState('Isaac Mutinda');
  const [formStatus, setFormStatus] = useState<BlogPostStatus>('Draft');
  const [formPublishDate, setFormPublishDate] = useState('2026-09-23');
  const [formContent, setFormContent] = useState('');
  const [formMetaTitle, setFormMetaTitle] = useState('');
  const [formMetaDescription, setFormMetaDescription] = useState('');

  const coverInputRef = useRef<HTMLInputElement>(null);
  const [postToDelete, setPostToDelete] = useState<BlogPost | null>(null);

  const anyOverlayOpen = isEditorOpen || postToDelete !== null;

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
        if (postToDelete) setPostToDelete(null);
        else if (isEditorOpen) setIsEditorOpen(false);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [anyOverlayOpen, postToDelete, isEditorOpen]);

  const toast = (msg: string) => setToastMessage(msg);

  const handleCoverImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormCoverImage(URL.createObjectURL(file));
    toast(`Cover uploaded (${file.name})`);
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const openAdd = () => {
    setEditorMode('add');
    setCurrentPostId(null);
    setFormTitle('');
    setFormSlug('');
    setFormExcerpt('');
    setFormCoverImage(
      'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80'
    );
    setFormCategory('Payments');
    setFormTags('SokoFlow, Engineering');
    setFormAuthor('Isaac Mutinda');
    setFormStatus('Draft');
    setFormPublishDate('2026-09-23');
    setFormContent('');
    setFormMetaTitle('');
    setFormMetaDescription('');
    setIsEditorOpen(true);
  };

  const openEdit = (post: BlogPost) => {
    setEditorMode('edit');
    setCurrentPostId(post.id);
    setFormTitle(post.title);
    setFormSlug(post.slug);
    setFormExcerpt(post.excerpt);
    setFormCoverImage(post.coverImage);
    setFormCategory(post.category);
    setFormTags(post.tags.join(', '));
    setFormAuthor(post.author);
    setFormStatus(post.status);
    setFormPublishDate('2026-09-23');
    setFormContent(post.content);
    setFormMetaTitle(post.metaTitle || '');
    setFormMetaDescription(post.metaDescription || '');
    setIsEditorOpen(true);
  };

  const savePost = (statusToSet?: BlogPostStatus) => {
    if (!formTitle.trim()) {
      toast('Post title is required');
      return;
    }
    const finalStatus = statusToSet || formStatus;
    const tagArray = formTags.split(',').map((t) => t.trim()).filter(Boolean);

    if (editorMode === 'add') {
      const newPost: BlogPost = {
        id: `post-${Date.now()}`,
        title: formTitle,
        slug: formSlug || `/blog/${formTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        excerpt: formExcerpt,
        coverImage: formCoverImage,
        author: formAuthor,
        category: formCategory,
        tags: tagArray,
        status: finalStatus,
        views: 0,
        publishDate: 'Today',
        content: formContent,
        metaTitle: formMetaTitle,
        metaDescription: formMetaDescription,
      };
      setPosts([newPost, ...posts]);
      toast(`Post created as ${finalStatus.toLowerCase()}`);
    } else {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === currentPostId
            ? {
                ...p,
                title: formTitle,
                slug: formSlug,
                excerpt: formExcerpt,
                coverImage: formCoverImage,
                author: formAuthor,
                category: formCategory,
                tags: tagArray,
                status: finalStatus,
                content: formContent,
                metaTitle: formMetaTitle,
                metaDescription: formMetaDescription,
              }
            : p
        )
      );
      toast('Post updated');
    }
    setIsEditorOpen(false);
  };

  const confirmDelete = () => {
    if (!postToDelete) return;
    setPosts((prev) => prev.filter((p) => p.id !== postToDelete.id));
    setPostToDelete(null);
    toast('Post deleted');
  };

  const insertFormatting = (tag: string) => {
    setFormContent((prev) => prev + ` [${tag}] `);
    toast(`Inserted ${tag} block`);
  };

  const totalPostsCount = posts.length;
  const publishedCount = posts.filter((p) => p.status === 'Published').length;
  const draftsCount = posts.filter((p) => p.status === 'Draft').length;
  const totalViewsCount = posts.reduce((acc, p) => acc + p.views, 0);

  const filteredPosts = posts.filter((post) => {
    if (statusFilter !== 'All' && post.status !== statusFilter) return false;
    if (categoryFilter !== 'All' && post.category !== categoryFilter) return false;
    if (authorFilter !== 'All' && post.author !== authorFilter) return false;
    if (searchQuery.trim() && !post.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const statusBadge = (s: BlogPostStatus) =>
    s === 'Published'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'Scheduled'
      ? 'bg-blue-50 text-blue-950 border-blue-100'
      : 'bg-amber-50 text-amber-700 border-amber-100';

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

      {/* ─────────── LIST VIEW ─────────── */}
      {!isEditorOpen && (
        <>
          <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
            <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-[15px] font-semibold text-slate-900">Blog</h1>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Manage articles, tutorials, and merchant announcements
                </p>
              </div>
              <button
                onClick={openAdd}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
              >
                <Plus className="w-3.5 h-3.5" />
                New post
              </button>
            </div>
          </header>

          <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

            {/* STATS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <StatCard
                label="Total posts"
                value={totalPostsCount.toString()}
                icon={<BookOpen className="w-4 h-4" />}
                tint="bg-blue-50 text-blue-950"
              />
              <StatCard
                label="Published"
                value={publishedCount.toString()}
                icon={<CheckCircle2 className="w-4 h-4" />}
                tint="bg-emerald-50 text-emerald-700"
              />
              <StatCard
                label="Drafts"
                value={draftsCount.toString()}
                icon={<Edit3 className="w-4 h-4" />}
                tint="bg-amber-50 text-amber-700"
              />
              <StatCard
                label="Total views"
                value={totalViewsCount.toLocaleString()}
                icon={<TrendingUp className="w-4 h-4" />}
                tint="bg-purple-50 text-purple-700"
                mono
              />
            </div>

            {/* FILTERS */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search blog posts…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-950"
                >
                  <option value="All">Status: All</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-950"
                >
                  <option value="All">Category: All</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={authorFilter}
                  onChange={(e) => setAuthorFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-950"
                >
                  <option value="All">Author: All</option>
                  {AUTHORS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                {(statusFilter !== 'All' ||
                  categoryFilter !== 'All' ||
                  authorFilter !== 'All' ||
                  searchQuery) && (
                  <button
                    onClick={() => {
                      setStatusFilter('All');
                      setCategoryFilter('All');
                      setAuthorFilter('All');
                      setSearchQuery('');
                    }}
                    className="text-[13px] text-red-600 hover:underline font-medium px-2 py-2"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* TABLE */}
            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <p className="text-[13px] font-medium text-slate-700">
                  Posts · {filteredPosts.length} of {posts.length}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-3 font-medium w-16">Cover</th>
                      <th className="py-2 px-3 font-medium">Title</th>
                      <th className="py-2 px-3 font-medium">Author</th>
                      <th className="py-2 px-3 font-medium">Category</th>
                      <th className="py-2 px-3 font-medium">Status</th>
                      <th className="py-2 px-3 font-medium text-right">Views</th>
                      <th className="py-2 px-3 font-medium">Date</th>
                      <th className="py-2 px-3 w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPosts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 text-[13px]">
                          No blog posts match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredPosts.map((post) => (
                        <tr
                          key={post.id}
                          onClick={() => openEdit(post)}
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <td className="py-2 px-3">
                            <img
                              src={post.coverImage}
                              alt=""
                              className="w-12 h-9 rounded-sm object-cover border border-slate-200"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <p className="font-medium text-slate-900 truncate max-w-xs">
                              {post.title}
                            </p>
                            <p className="text-[13px] text-slate-400 font-mono truncate max-w-xs mt-0.5">
                              {post.slug}
                            </p>
                          </td>
                          <td className="py-2 px-3 text-slate-700">{post.author}</td>
                          <td className="py-2 px-3">
                            <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded-sm font-medium border border-slate-200">
                              {post.category}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${statusBadge(
                                post.status
                              )}`}
                            >
                              {post.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-800">
                            {post.views.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-slate-500 font-mono">
                            {post.publishDate}
                          </td>
                          <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEdit(post)}
                                title="Edit"
                                className="p-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setPostToDelete(post)}
                                title="Delete"
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
              <p className="text-[13px] font-medium text-slate-500 truncate">
                {editorMode === 'add' ? 'Creating new post' : 'Editing post'}
              </p>
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
                onClick={() => savePost('Draft')}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-2 rounded-sm text-[13px]"
              >
                <Save className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save draft</span>
              </button>
              <button
                onClick={() => savePost('Published')}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
              >
                <Send className="w-3.5 h-3.5" />
                Publish
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

            {/* LEFT — main content */}
            <div className="flex-1 flex flex-col bg-white border-r border-slate-200 overflow-y-auto p-3 space-y-3">

              {/* Title */}
              <input
                type="text"
                placeholder="Post title"
                value={formTitle}
                onChange={(e) => {
                  setFormTitle(e.target.value);
                  if (editorMode === 'add') {
                    setFormSlug(
                      `/blog/${e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
                    );
                  }
                }}
                className="w-full text-[15px] font-semibold text-slate-900 bg-transparent border-b border-slate-200 focus:outline-none focus:border-blue-950 pb-2 placeholder:text-slate-300"
              />

              {/* Excerpt */}
              <div>
                <label className="block font-medium text-slate-700 mb-1 text-[13px]">
                  Excerpt
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief summary displayed on blog feed cards…"
                  value={formExcerpt}
                  onChange={(e) => setFormExcerpt(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </div>

              {/* Cover image */}
              <div>
                <label className="flex items-center gap-1.5 font-medium text-slate-700 text-[13px] mb-1">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-950" />
                  Cover image
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative w-36 h-20 rounded-sm overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                    <img
                      src={formCoverImage}
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                    >
                      <Upload className="w-3.5 h-3.5 text-blue-950" />
                      Upload new cover
                    </button>
                    <p className="text-[13px] text-slate-400">1200×630px · PNG / JPG / WebP</p>
                    <input
                      type="file"
                      ref={coverInputRef}
                      onChange={handleCoverImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Rich text editor */}
              <div className="flex-1 flex flex-col border border-slate-200 rounded-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 p-1.5 flex flex-wrap items-center gap-0.5 shrink-0">
                  <ToolBtn icon={Bold} onClick={() => insertFormatting('bold')} label="Bold" />
                  <ToolBtn icon={Italic} onClick={() => insertFormatting('italic')} label="Italic" />
                  <span className="w-px h-4 bg-slate-200 mx-1" />
                  <ToolBtn icon={Heading} onClick={() => insertFormatting('h1')} label="Heading" />
                  <ToolBtn icon={List} onClick={() => insertFormatting('list')} label="List" />
                  <ToolBtn icon={LinkIcon} onClick={() => insertFormatting('link')} label="Link" />
                  <ToolBtn icon={ImageIcon} onClick={() => insertFormatting('image')} label="Image" />
                  <ToolBtn icon={Video} onClick={() => insertFormatting('video')} label="Video" />
                  <ToolBtn icon={Code} onClick={() => insertFormatting('code')} label="Code" />
                </div>
                <textarea
                  placeholder="Write your article body content here…"
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full flex-1 p-3 bg-transparent border-none text-[13px] text-slate-900 focus:outline-none resize-none leading-relaxed font-mono min-h-[260px]"
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
                    onChange={(e) => setFormStatus(e.target.value as BlogPostStatus)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Publish date</label>
                  <input
                    type="date"
                    value={formPublishDate}
                    onChange={(e) => setFormPublishDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
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
              </div>

              {/* Taxonomy */}
              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
                <p className="font-medium text-slate-900 border-b border-slate-100 pb-2">
                  Taxonomy
                </p>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Author</label>
                  <select
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  >
                    {AUTHORS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
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
      {postToDelete && (
        <div
          className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setPostToDelete(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl text-center space-y-3 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-sm bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Delete blog post?</h3>
              <p className="text-slate-500 mt-1">
                Remove{' '}
                <span className="font-medium text-slate-800">"{postToDelete.title}"</span>? This
                cannot be undone.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => setPostToDelete(null)}
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

/* ---------- Stat card ---------- */
function StatCard({
  label,
  value,
  icon,
  tint,
  mono,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tint: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-500 truncate">{label}</p>
        <p
          className={`text-[15px] font-bold text-slate-900 mt-0.5 truncate ${
            mono ? 'font-mono' : ''
          }`}
        >
          {value}
        </p>
      </div>
      <span className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${tint}`}>
        {icon}
      </span>
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