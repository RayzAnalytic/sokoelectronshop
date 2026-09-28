'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, Plus, CheckCircle2, X, Trash2, Edit3, ArrowLeft, Eye, Save, Send,
  Globe, Search, Bold, Italic, Heading, List, Link as LinkIcon, Image as ImageIcon,
  Video, Code, AlertCircle, Upload, TrendingUp, Tag, Users, CalendarClock,
  Star, FolderTree,
} from 'lucide-react';

type BlogPostStatus = 'Published' | 'Draft' | 'Scheduled';
type BlogModule = 'posts' | 'categories' | 'tags' | 'authors';

interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  postCount: number;
}

interface BlogTag {
  id: string;
  name: string;
  slug: string;
  postCount: number;
}

interface BlogAuthor {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  bio: string;
  postCount: number;
  social: { twitter?: string; linkedin?: string };
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  coverAlt?: string;
  author: string;
  category: string;
  tags: string[];
  status: BlogPostStatus;
  featured: boolean;
  views: number;
  publishDate: string;
  publishTime?: string;
  scheduledFor?: string;
  timezone?: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
}

const INITIAL_CATEGORIES: BlogCategory[] = [
  { id: 'cat-1', name: 'Buying Guides', slug: 'buying-guides', description: 'How to choose the right electronics for your home or business.', postCount: 0 },
  { id: 'cat-2', name: 'Product Reviews', slug: 'product-reviews', description: 'Hands-on reviews of routers, monitors, keyboards, and accessories.', postCount: 0 },
  { id: 'cat-3', name: 'Setup & Tutorials', slug: 'setup-tutorials', description: 'Step-by-step guides for installing and configuring devices.', postCount: 0 },
  { id: 'cat-4', name: 'Deals & Offers', slug: 'deals-offers', description: 'Weekly promotions, M-Pesa discounts, and bundle savings.', postCount: 0 },
  { id: 'cat-5', name: 'Company News', slug: 'company-news', description: 'Updates from SokoFlow Electronics — new stock, partnerships, store news.', postCount: 0 },
];

const INITIAL_TAGS: BlogTag[] = [
  { id: 'tag-1', name: 'Wi-Fi Routers', slug: 'wifi-routers', postCount: 0 },
  { id: 'tag-2', name: 'Monitors', slug: 'monitors', postCount: 0 },
  { id: 'tag-3', name: 'Keyboards', slug: 'keyboards', postCount: 0 },
  { id: 'tag-4', name: 'USB-C Hubs', slug: 'usb-c-hubs', postCount: 0 },
  { id: 'tag-5', name: 'M-Pesa', slug: 'm-pesa', postCount: 0 },
  { id: 'tag-6', name: 'Same-Day Delivery', slug: 'same-day-delivery', postCount: 0 },
  { id: 'tag-7', name: 'Home Office', slug: 'home-office', postCount: 0 },
  { id: 'tag-8', name: 'Gaming', slug: 'gaming', postCount: 0 },
];

const INITIAL_AUTHORS: BlogAuthor[] = [
  {
    id: 'auth-1',
    name: 'Isaac Mutinda',
    email: 'isaac@sokoflow.co.ke',
    role: 'Founder & Editor',
    avatar: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?auto=format&fit=crop&w=200&q=80',
    bio: 'Runs SokoFlow Electronics and writes about home networking, M-Pesa integrations, and running a modern Kenyan storefront.',
    postCount: 0,
    social: { twitter: '@isaacmutinda', linkedin: 'isaac-mutinda' },
  },
  {
    id: 'auth-2',
    name: 'Brenda Akinyi',
    email: 'brenda@sokoflow.co.ke',
    role: 'Product Reviewer',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    bio: 'Tests every router, monitor, and accessory before it hits the SokoFlow catalog. Reviews with real Kenyan workloads.',
    postCount: 0,
    social: { twitter: '@brenda_reviews' },
  },
  {
    id: 'auth-3',
    name: 'Brian Kipkorir',
    email: 'brian@sokoflow.co.ke',
    role: 'Support & Tutorials Lead',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    bio: 'Writes the setup guides customers actually read. Runs the SokoFlow support desk in Nairobi.',
    postCount: 0,
    social: { linkedin: 'brian-kipkorir' },
  },
];

const INITIAL_POSTS: BlogPost[] = [
  {
    id: 'post-1',
    title: 'The Best Wi-Fi Routers in Kenya for 2026 (Tested in Nairobi Homes)',
    slug: '/blog/best-wifi-routers-kenya-2026',
    excerpt: 'We tested 12 routers on Safaricom Fibre across Kilimani, Westlands, and Runda. Here are the ones that actually deliver full-speed Wi-Fi 6.',
    coverImage: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200&q=80',
    coverAlt: 'White Wi-Fi router on a wooden desk',
    author: 'Brenda Akinyi',
    category: 'Buying Guides',
    tags: ['Wi-Fi Routers', 'Home Office'],
    status: 'Published',
    featured: true,
    views: 4820,
    publishDate: 'Sep 20, 2026',
    publishTime: '09:00',
    timezone: 'Africa/Nairobi',
    content: 'Choosing a router in Kenya is not the same as choosing one in Europe. Fibre installs vary by ISP, power cuts are real, and most homes have concrete walls that destroy 5 GHz signal…',
    metaTitle: 'Best Wi-Fi Routers in Kenya 2026 | SokoFlow Tested',
    metaDescription: 'Hands-on review of 12 Wi-Fi routers sold in Kenya. Real Nairobi-home speed tests, coverage, and value picks.',
  },
  {
    id: 'post-2',
    title: 'UltraWide vs Dual Monitor: Which Is Better for Kenyan Home Offices?',
    slug: '/blog/ultrawide-vs-dual-monitor-home-office',
    excerpt: 'A 29-inch ultra-wide can replace two 24-inch screens — but only if you use the right window layout.',
    coverImage: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1200&q=80',
    coverAlt: 'Ultrawide monitor on a clean desk',
    author: 'Brenda Akinyi',
    category: 'Buying Guides',
    tags: ['Monitors', 'Home Office'],
    status: 'Published',
    featured: false,
    views: 2310,
    publishDate: 'Sep 15, 2026',
    publishTime: '14:30',
    timezone: 'Africa/Nairobi',
    content: 'The 29-inch ultra-wide has become the default SokoFlow recommendation for remote workers in Nairobi…',
    metaTitle: 'UltraWide vs Dual Monitor for Kenyan Home Offices',
    metaDescription: 'Which is better for a Nairobi home office — a 29-inch ultra-wide or two 24-inch monitors?',
  },
  {
    id: 'post-3',
    title: 'How to Set Up Your New Router in 5 Minutes (Safaricom, Zuku, Faiba)',
    slug: '/blog/setup-new-router-safaricom-zuku-faiba',
    excerpt: 'Plug in, log in, done. A no-jargon setup guide that works with every Kenyan ISP.',
    coverImage: 'https://images.unsplash.com/photo-1606904825846-647eb07f5be2?auto=format&fit=crop&w=1200&q=80',
    coverAlt: 'Router with glowing status lights',
    author: 'Brian Kipkorir',
    category: 'Setup & Tutorials',
    tags: ['Wi-Fi Routers', 'Same-Day Delivery'],
    status: 'Published',
    featured: false,
    views: 6110,
    publishDate: 'Sep 10, 2026',
    publishTime: '11:00',
    timezone: 'Africa/Nairobi',
    content: 'Every router we ship from SokoFlow Electronics comes with a pre-configured card for Safaricom Fibre, Zuku, and Faiba…',
    metaTitle: 'How to Set Up a New Router in Kenya | SokoFlow Guide',
    metaDescription: 'Step-by-step router setup for Safaricom Fibre, Zuku, and Faiba.',
  },
  {
    id: 'post-4',
    title: '5 USB-C Hubs That Actually Work With Kenyan Laptops',
    slug: '/blog/best-usb-c-hubs-kenya',
    excerpt: 'Cheap hubs fry SSD drives. These five survived our stress test.',
    coverImage: 'https://images.unsplash.com/photo-1625842268584-8f3296236761?auto=format&fit=crop&w=1200&q=80',
    coverAlt: 'USB-C hub with cables attached',
    author: 'Brenda Akinyi',
    category: 'Product Reviews',
    tags: ['USB-C Hubs', 'Home Office'],
    status: 'Published',
    featured: false,
    views: 1890,
    publishDate: 'Sep 05, 2026',
    publishTime: '16:00',
    timezone: 'Africa/Nairobi',
    content: 'A bad USB-C hub will corrupt your external drive. We bought 14 hubs from Kenyan sellers…',
    metaTitle: 'Best USB-C Hubs in Kenya 2026 | Tested',
    metaDescription: 'We stress-tested 14 USB-C hubs sold in Kenya. These five survived.',
  },
  {
    id: 'post-5',
    title: 'Weekend Flash Sale: Up to 20% Off Home Office Electronics',
    slug: '/blog/weekend-flash-sale-home-office',
    excerpt: 'Routers, monitors, keyboards, and hubs — discounted until Sunday midnight.',
    coverImage: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1200&q=80',
    coverAlt: 'Mechanical keyboard on desk',
    author: 'Isaac Mutinda',
    category: 'Deals & Offers',
    tags: ['M-Pesa', 'Same-Day Delivery'],
    status: 'Published',
    featured: true,
    views: 3420,
    publishDate: 'Sep 22, 2026',
    publishTime: '08:00',
    timezone: 'Africa/Nairobi',
    content: 'Every quarter we clear older stock to make room for new arrivals…',
    metaTitle: 'Weekend Flash Sale | SokoFlow Electronics Kenya',
    metaDescription: 'Up to 20% off home office electronics. M-Pesa accepted, same-day Nairobi delivery.',
  },
  {
    id: 'post-6',
    title: 'SokoFlow Now Offers 3-Hour Delivery in Nairobi CBD & Westlands',
    slug: '/blog/3-hour-delivery-nairobi-cbd',
    excerpt: 'Order before 2 PM and your router, monitor, or keyboard arrives the same afternoon.',
    coverImage: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80',
    coverAlt: 'Delivery rider in Nairobi',
    author: 'Isaac Mutinda',
    category: 'Company News',
    tags: ['Same-Day Delivery'],
    status: 'Scheduled',
    featured: false,
    views: 0,
    publishDate: 'Oct 01, 2026',
    publishTime: '10:00',
    scheduledFor: '2026-10-01T10:00',
    timezone: 'Africa/Nairobi',
    content: 'Starting next month, SokoFlow Electronics is rolling out 3-hour delivery windows…',
    metaTitle: 'SokoFlow Launches 3-Hour Delivery in Nairobi',
    metaDescription: 'Same-day 3-hour delivery now live in Nairobi CBD and Westlands.',
  },
  {
    id: 'post-7',
    title: 'Why Wi-Fi 7 Is Not Worth Buying in Kenya Yet (2026 Reality Check)',
    slug: '/blog/why-wifi-7-not-worth-kenya-2026',
    excerpt: 'Wi-Fi 7 routers cost 3× Wi-Fi 6 — and no ISP in Kenya delivers speeds that need it.',
    coverImage: 'https://images.unsplash.com/photo-1606904825846-647eb07f5be2?auto=format&fit=crop&w=1200&q=80',
    coverAlt: 'Router close-up with LED indicators',
    author: 'Brenda Akinyi',
    category: 'Buying Guides',
    tags: ['Wi-Fi Routers'],
    status: 'Draft',
    featured: false,
    views: 0,
    publishDate: 'Sep 25, 2026',
    publishTime: '09:00',
    timezone: 'Africa/Nairobi',
    content: 'Wi-Fi 7 is genuinely faster in a lab. In a Kenyan home on a 100 Mbps line, it changes nothing…',
    metaTitle: 'Why Wi-Fi 7 Is Not Worth Buying in Kenya Yet',
    metaDescription: 'A practical look at Wi-Fi 7 in Kenya — price, real-world gains, and what to buy instead.',
  },
];

const STATUSES: BlogPostStatus[] = ['Published', 'Draft', 'Scheduled'];

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default function BlogAdminPage() {
  const [posts, setPosts] = useState<BlogPost[]>(INITIAL_POSTS);
  const [categories, setCategories] = useState<BlogCategory[]>(INITIAL_CATEGORIES);
  const [tags, setTags] = useState<BlogTag[]>(INITIAL_TAGS);
  const [authors, setAuthors] = useState<BlogAuthor[]>(INITIAL_AUTHORS);

  const [activeModule, setActiveModule] = useState<BlogModule>('posts');
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
    'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200&q=80'
  );
  const [formCoverAlt, setFormCoverAlt] = useState('');
  const [formCategory, setFormCategory] = useState('Buying Guides');
  const [formTags, setFormTags] = useState('');
  const [formAuthor, setFormAuthor] = useState('Isaac Mutinda');
  const [formStatus, setFormStatus] = useState<BlogPostStatus>('Draft');
  const [formFeatured, setFormFeatured] = useState(false);
  const [formPublishDate, setFormPublishDate] = useState('2026-09-23');
  const [formPublishTime, setFormPublishTime] = useState('09:00');
  const [formScheduledFor, setFormScheduledFor] = useState('');
  const [formTimezone, setFormTimezone] = useState('Africa/Nairobi');
  const [formContent, setFormContent] = useState('');
  const [formMetaTitle, setFormMetaTitle] = useState('');
  const [formMetaDescription, setFormMetaDescription] = useState('');

  const [editorTab, setEditorTab] = useState<'content' | 'media' | 'seo' | 'schedule'>('content');

  const coverInputRef = useRef<HTMLInputElement>(null);
  const [postToDelete, setPostToDelete] = useState<BlogPost | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BlogCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<BlogTag | null>(null);
  const [tagName, setTagName] = useState('');

  const [isAuthorModalOpen, setIsAuthorModalOpen] = useState(false);
  const [editingAuthor, setEditingAuthor] = useState<BlogAuthor | null>(null);
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authRole, setAuthRole] = useState('');
  const [authBio, setAuthBio] = useState('');

  const anyOverlayOpen =
    isEditorOpen || postToDelete !== null || isCategoryModalOpen || isTagModalOpen || isAuthorModalOpen;

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
        if (isCategoryModalOpen) setIsCategoryModalOpen(false);
        else if (isTagModalOpen) setIsTagModalOpen(false);
        else if (isAuthorModalOpen) setIsAuthorModalOpen(false);
        else if (postToDelete) setPostToDelete(null);
        else if (isEditorOpen) setIsEditorOpen(false);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [anyOverlayOpen, isCategoryModalOpen, isTagModalOpen, isAuthorModalOpen, postToDelete, isEditorOpen]);

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
    setFormCoverImage('https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200&q=80');
    setFormCoverAlt('');
    setFormCategory(categories[0]?.name || 'Buying Guides');
    setFormTags('');
    setFormAuthor(authors[0]?.name || 'Isaac Mutinda');
    setFormStatus('Draft');
    setFormFeatured(false);
    setFormPublishDate('2026-09-23');
    setFormPublishTime('09:00');
    setFormScheduledFor('');
    setFormTimezone('Africa/Nairobi');
    setFormContent('');
    setFormMetaTitle('');
    setFormMetaDescription('');
    setEditorTab('content');
    setIsEditorOpen(true);
  };

  const openEdit = (post: BlogPost) => {
    setEditorMode('edit');
    setCurrentPostId(post.id);
    setFormTitle(post.title);
    setFormSlug(post.slug);
    setFormExcerpt(post.excerpt);
    setFormCoverImage(post.coverImage);
    setFormCoverAlt(post.coverAlt || '');
    setFormCategory(post.category);
    setFormTags(post.tags.join(', '));
    setFormAuthor(post.author);
    setFormStatus(post.status);
    setFormFeatured(post.featured);
    setFormPublishDate('2026-09-23');
    setFormPublishTime(post.publishTime || '09:00');
    setFormScheduledFor(post.scheduledFor || '');
    setFormTimezone(post.timezone || 'Africa/Nairobi');
    setFormContent(post.content);
    setFormMetaTitle(post.metaTitle || '');
    setFormMetaDescription(post.metaDescription || '');
    setEditorTab('content');
    setIsEditorOpen(true);
  };

  const savePost = (statusToSet?: BlogPostStatus) => {
    if (!formTitle.trim()) {
      toast('Post title is required');
      return;
    }
    const finalStatus = statusToSet || formStatus;
    if (finalStatus === 'Scheduled' && !formScheduledFor) {
      toast('Scheduled posts need a date & time');
      return;
    }
    const tagArray = formTags.split(',').map((t) => t.trim()).filter(Boolean);

    if (editorMode === 'add') {
      const newPost: BlogPost = {
        id: `post-${Date.now()}`,
        title: formTitle,
        slug: formSlug || `/blog/${slugify(formTitle)}`,
        excerpt: formExcerpt,
        coverImage: formCoverImage,
        coverAlt: formCoverAlt,
        author: formAuthor,
        category: formCategory,
        tags: tagArray,
        status: finalStatus,
        featured: formFeatured,
        views: 0,
        publishDate: formPublishDate,
        publishTime: formPublishTime,
        scheduledFor: finalStatus === 'Scheduled' ? formScheduledFor : undefined,
        timezone: formTimezone,
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
              coverAlt: formCoverAlt,
              author: formAuthor,
              category: formCategory,
              tags: tagArray,
              status: finalStatus,
              featured: formFeatured,
              publishTime: formPublishTime,
              scheduledFor: finalStatus === 'Scheduled' ? formScheduledFor : undefined,
              timezone: formTimezone,
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
  const scheduledCount = posts.filter((p) => p.status === 'Scheduled').length;
  const totalViewsCount = posts.reduce((acc, p) => acc + p.views, 0);

  const filteredPosts = useMemo(
    () =>
      posts.filter((post) => {
        if (statusFilter !== 'All' && post.status !== statusFilter) return false;
        if (categoryFilter !== 'All' && post.category !== categoryFilter) return false;
        if (authorFilter !== 'All' && post.author !== authorFilter) return false;
        if (searchQuery.trim() && !post.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      }),
    [posts, statusFilter, categoryFilter, authorFilter, searchQuery]
  );

  const statusBadge = (s: BlogPostStatus) =>
    s === 'Published'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'Scheduled'
        ? 'bg-blue-50 text-blue-950 border-blue-100'
        : 'bg-amber-50 text-amber-700 border-amber-100';

  const openCategoryModal = (c?: BlogCategory) => {
    if (c) {
      setEditingCategory(c);
      setCatName(c.name);
      setCatDesc(c.description);
    } else {
      setEditingCategory(null);
      setCatName('');
      setCatDesc('');
    }
    setIsCategoryModalOpen(true);
  };

  const saveCategory = () => {
    if (!catName.trim()) {
      toast('Category name required');
      return;
    }
    if (editingCategory) {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === editingCategory.id ? { ...c, name: catName, slug: slugify(catName), description: catDesc } : c
        )
      );
      toast('Category updated');
    } else {
      setCategories((prev) => [
        ...prev,
        { id: `cat-${Date.now()}`, name: catName, slug: slugify(catName), description: catDesc, postCount: 0 },
      ]);
      toast('Category added');
    }
    setIsCategoryModalOpen(false);
  };

  const deleteCategory = (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    toast('Category deleted');
  };

  const openTagModal = (t?: BlogTag) => {
    if (t) {
      setEditingTag(t);
      setTagName(t.name);
    } else {
      setEditingTag(null);
      setTagName('');
    }
    setIsTagModalOpen(true);
  };

  const saveTag = () => {
    if (!tagName.trim()) {
      toast('Tag name required');
      return;
    }
    if (editingTag) {
      setTags((prev) =>
        prev.map((t) => (t.id === editingTag.id ? { ...t, name: tagName, slug: slugify(tagName) } : t))
      );
      toast('Tag updated');
    } else {
      setTags((prev) => [
        ...prev,
        { id: `tag-${Date.now()}`, name: tagName, slug: slugify(tagName), postCount: 0 },
      ]);
      toast('Tag added');
    }
    setIsTagModalOpen(false);
  };

  const deleteTag = (id: string) => {
    setTags((prev) => prev.filter((t) => t.id !== id));
    toast('Tag deleted');
  };

  const openAuthorModal = (a?: BlogAuthor) => {
    if (a) {
      setEditingAuthor(a);
      setAuthName(a.name);
      setAuthEmail(a.email);
      setAuthRole(a.role);
      setAuthBio(a.bio);
    } else {
      setEditingAuthor(null);
      setAuthName('');
      setAuthEmail('');
      setAuthRole('');
      setAuthBio('');
    }
    setIsAuthorModalOpen(true);
  };

  const saveAuthor = () => {
    if (!authName.trim()) {
      toast('Author name required');
      return;
    }
    if (editingAuthor) {
      setAuthors((prev) =>
        prev.map((a) =>
          a.id === editingAuthor.id
            ? { ...a, name: authName, email: authEmail, role: authRole, bio: authBio }
            : a
        )
      );
      toast('Author updated');
    } else {
      setAuthors((prev) => [
        ...prev,
        {
          id: `auth-${Date.now()}`,
          name: authName,
          email: authEmail,
          role: authRole,
          bio: authBio,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(authName)}&background=1e293b&color=fff`,
          postCount: 0,
          social: {},
        },
      ]);
      toast('Author added');
    }
    setIsAuthorModalOpen(false);
  };

  const deleteAuthor = (id: string) => {
    setAuthors((prev) => prev.filter((a) => a.id !== id));
    toast('Author deleted');
  };

  const moduleTabs: { key: BlogModule; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'posts', label: 'Posts', icon: <BookOpen className="w-3.5 h-3.5" />, badge: posts.length },
    { key: 'categories', label: 'Categories', icon: <FolderTree className="w-3.5 h-3.5" />, badge: categories.length },
    { key: 'tags', label: 'Tags', icon: <Tag className="w-3.5 h-3.5" />, badge: tags.length },
    { key: 'authors', label: 'Authors', icon: <Users className="w-3.5 h-3.5" />, badge: authors.length },
  ];

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

      {!isEditorOpen && (
        <>
          <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
            <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-[15px] font-semibold text-slate-900">Blog</h1>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Buying guides, reviews, tutorials, and offers that drive organic traffic
                </p>
              </div>
              {activeModule === 'posts' && (
                <button
                  onClick={openAdd}
                  className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New post
                </button>
              )}
              {activeModule === 'categories' && (
                <button
                  onClick={() => openCategoryModal()}
                  className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New category
                </button>
              )}
              {activeModule === 'tags' && (
                <button
                  onClick={() => openTagModal()}
                  className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New tag
                </button>
              )}
              {activeModule === 'authors' && (
                <button
                  onClick={() => openAuthorModal()}
                  className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New author
                </button>
              )}
            </div>
          </header>

          <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">
            <div className="bg-white border border-slate-200 rounded-sm p-0.5 flex items-center gap-0.5 overflow-x-auto">
              {moduleTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveModule(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${activeModule === tab.key ? 'bg-blue-50 text-blue-950' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.badge !== undefined && (
                    <span
                      className={`px-1.5 rounded-sm text-[13px] ${activeModule === tab.key ? 'bg-blue-100 text-blue-950' : 'bg-slate-200 text-slate-600'
                        }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {activeModule === 'posts' && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                  <StatCard label="Total posts" value={totalPostsCount.toString()} icon={<BookOpen className="w-4 h-4" />} tint="bg-blue-50 text-blue-950" />
                  <StatCard label="Published" value={publishedCount.toString()} icon={<CheckCircle2 className="w-4 h-4" />} tint="bg-emerald-50 text-emerald-700" />
                  <StatCard label="Drafts" value={draftsCount.toString()} icon={<Edit3 className="w-4 h-4" />} tint="bg-amber-50 text-amber-700" />
                  <StatCard label="Scheduled" value={scheduledCount.toString()} icon={<CalendarClock className="w-4 h-4" />} tint="bg-blue-50 text-blue-950" />
                  <StatCard label="Total views" value={totalViewsCount.toLocaleString()} icon={<TrendingUp className="w-4 h-4" />} tint="bg-purple-50 text-purple-700" mono />
                </div>

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
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-950"
                    >
                      <option value="All">Category: All</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    <select
                      value={authorFilter}
                      onChange={(e) => setAuthorFilter(e.target.value)}
                      className="bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-950"
                    >
                      <option value="All">Author: All</option>
                      {authors.map((a) => (
                        <option key={a.id} value={a.name}>{a.name}</option>
                      ))}
                    </select>
                    {(statusFilter !== 'All' || categoryFilter !== 'All' || authorFilter !== 'All' || searchQuery) && (
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
                                <img src={post.coverImage} alt="" className="w-12 h-9 rounded-sm object-cover border border-slate-200" />
                              </td>
                              <td className="py-2 px-3">
                                <p className="font-medium text-slate-900 truncate max-w-xs inline-flex items-center gap-1.5">
                                  {post.featured && <Star className="w-3 h-3 text-amber-500 shrink-0" />}
                                  {post.title}
                                </p>
                                <p className="text-[13px] text-slate-400 font-mono truncate max-w-xs mt-0.5">{post.slug}</p>
                              </td>
                              <td className="py-2 px-3 text-slate-700">{post.author}</td>
                              <td className="py-2 px-3">
                                <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded-sm font-medium border border-slate-200">
                                  {post.category}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${statusBadge(post.status)}`}>
                                  {post.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-800">{post.views.toLocaleString()}</td>
                              <td className="py-2 px-3 text-slate-500 font-mono">{post.publishDate}</td>
                              <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => openEdit(post)} title="Edit" className="p-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition">
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => setPostToDelete(post)} title="Delete" className="p-2 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 transition">
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
              </>
            )}

            {activeModule === 'categories' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {categories.map((c) => {
                  const count = posts.filter((p) => p.category === c.name).length;
                  return (
                    <div key={c.id} className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                            <FolderTree className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-slate-900 truncate">{c.name}</p>
                            <p className="text-[13px] text-slate-400 font-mono truncate">/{c.slug}</p>
                          </div>
                        </div>
                        <span className="shrink-0 inline-block px-2 py-0.5 rounded-sm text-[13px] bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                          {count}
                        </span>
                      </div>
                      <p className="text-[13px] text-slate-500 line-clamp-2">{c.description}</p>
                      <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100">
                        <button onClick={() => openCategoryModal(c)} className="p-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteCategory(c.id)} className="p-2 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeModule === 'tags' && (
              <div className="bg-white border border-slate-200 rounded-sm p-3">
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => {
                    const count = posts.filter((p) => p.tags.includes(t.name)).length;
                    return (
                      <div key={t.id} className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-sm px-2 py-1.5">
                        <Tag className="w-3 h-3 text-blue-950 shrink-0" />
                        <span className="text-[13px] font-medium text-slate-800">{t.name}</span>
                        <span className="text-[13px] text-slate-400 font-mono">{count}</span>
                        <button onClick={() => openTagModal(t)} className="text-slate-400 hover:text-slate-700">
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button onClick={() => deleteTag(t.id)} className="text-red-500 hover:text-red-700">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeModule === 'authors' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {authors.map((a) => {
                  const count = posts.filter((p) => p.author === a.name).length;
                  return (
                    <div key={a.id} className="bg-white border border-slate-200 rounded-sm p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <img src={a.avatar} alt="" className="w-10 h-10 rounded-sm object-cover border border-slate-200 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-slate-900 truncate">{a.name}</p>
                          <p className="text-[13px] text-slate-500 truncate">{a.role}</p>
                          <p className="text-[13px] text-slate-400 font-mono truncate">{a.email}</p>
                        </div>
                        <span className="shrink-0 inline-block px-2 py-0.5 rounded-sm text-[13px] bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                          {count}
                        </span>
                      </div>
                      <p className="text-[13px] text-slate-500 line-clamp-3">{a.bio}</p>
                      <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100">
                        <button onClick={() => openAuthorModal(a)} className="p-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteAuthor(a.id)} className="p-2 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                onClick={() => savePost('Scheduled')}
                className="inline-flex items-center gap-1.5 bg-white border border-blue-200 hover:bg-blue-50 text-blue-950 font-medium px-2.5 py-2 rounded-sm text-[13px]"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Schedule</span>
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

          <div className="bg-white border-b border-slate-200 px-3 flex items-center gap-0.5 overflow-x-auto shrink-0">
            {(['content', 'media', 'seo', 'schedule'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setEditorTab(t)}
                className={`px-3 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap border-b-2 -mb-px ${editorTab === t ? 'text-blue-950 border-blue-950' : 'text-slate-600 border-transparent hover:text-slate-900'
                  }`}
              >
                {t === 'content' && 'Content'}
                {t === 'media' && 'Featured image'}
                {t === 'seo' && 'SEO'}
                {t === 'schedule' && 'Publishing'}
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 flex flex-col bg-white border-r border-slate-200 overflow-y-auto p-3 space-y-3">
              {editorTab === 'content' && (
                <>
                  <input
                    type="text"
                    placeholder="Post title"
                    value={formTitle}
                    onChange={(e) => {
                      setFormTitle(e.target.value);
                      if (editorMode === 'add') setFormSlug(`/blog/${slugify(e.target.value)}`);
                    }}
                    className="w-full text-[15px] font-semibold text-slate-900 bg-transparent border-b border-slate-200 focus:outline-none focus:border-blue-950 pb-2 placeholder:text-slate-300"
                  />

                  <div>
                    <label className="block font-medium text-slate-700 mb-1 text-[13px]">Excerpt</label>
                    <textarea
                      rows={2}
                      placeholder="Brief summary displayed on blog feed cards…"
                      value={formExcerpt}
                      onChange={(e) => setFormExcerpt(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                    />
                  </div>

                  <div className="flex-1 flex flex-col border border-slate-200 rounded-sm overflow-hidden min-h-[360px]">
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
                      className="w-full flex-1 p-3 bg-transparent border-none text-[13px] text-slate-900 focus:outline-none resize-none leading-relaxed font-mono"
                    />
                  </div>
                </>
              )}

              {editorTab === 'media' && (
                <div className="space-y-3">
                  <div>
                    <label className="flex items-center gap-1.5 font-medium text-slate-700 text-[13px] mb-1">
                      <ImageIcon className="w-3.5 h-3.5 text-blue-950" />
                      Featured cover image
                    </label>
                    <div className="relative w-full aspect-[1200/630] rounded-sm overflow-hidden border border-slate-200 bg-slate-100">
                      <img src={formCoverImage} alt="Cover" className="w-full h-full object-cover" />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                      >
                        <Upload className="w-3.5 h-3.5 text-blue-950" />
                        Upload cover
                      </button>
                      <p className="text-[13px] text-slate-400">1200×630px · PNG / JPG / WebP</p>
                      <input type="file" ref={coverInputRef} onChange={handleCoverImageUpload} accept="image/*" className="hidden" />
                    </div>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1 text-[13px]">Alt text</label>
                    <input
                      type="text"
                      placeholder="Describe the image for accessibility and SEO…"
                      value={formCoverAlt}
                      onChange={(e) => setFormCoverAlt(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                    />
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 text-[13px] space-y-1">
                    <p className="text-slate-500">Feed card preview</p>
                    <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                      <img src={formCoverImage} alt="" className="w-full aspect-[1200/630] object-cover" />
                      <div className="p-2 space-y-1">
                        <p className="text-[13px] font-semibold text-slate-900 line-clamp-2">{formTitle || 'Post title preview'}</p>
                        <p className="text-[13px] text-slate-500 line-clamp-2">{formExcerpt || 'Excerpt preview…'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {editorTab === 'seo' && (
                <div className="space-y-3 text-[13px]">
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
                    <label className="block font-medium text-slate-700 mb-1">SEO title</label>
                    <input
                      type="text"
                      placeholder="SEO title"
                      value={formMetaTitle}
                      onChange={(e) => setFormMetaTitle(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                    />
                    <p className="text-[13px] text-slate-400 mt-1">{formMetaTitle.length}/60</p>
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
                    <p className="text-[13px] text-slate-400 mt-1">{formMetaDescription.length}/160</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-sm p-3 space-y-1">
                    <p className="text-[13px] font-medium text-slate-500 mb-2">Google preview</p>
                    <p className="text-[13px] text-slate-500 font-mono truncate">https://sokoflow.co.ke{formSlug || '/blog/…'}</p>
                    <p className="text-[15px] text-blue-900 font-medium truncate">{formMetaTitle || formTitle || 'Untitled post'}</p>
                    <p className="text-[13px] text-slate-600 line-clamp-2">{formMetaDescription || 'No meta description set.'}</p>
                  </div>
                </div>
              )}

              {editorTab === 'schedule' && (
                <div className="space-y-3 text-[13px]">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Status</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as BlogPostStatus)}
                      className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                      <label className="block font-medium text-slate-700 mb-1">Publish time</label>
                      <input
                        type="time"
                        value={formPublishTime}
                        onChange={(e) => setFormPublishTime(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1 inline-flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      Schedule for (only if status = Scheduled)
                    </label>
                    <input
                      type="datetime-local"
                      value={formScheduledFor}
                      onChange={(e) => setFormScheduledFor(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Timezone</label>
                    <select
                      value={formTimezone}
                      onChange={(e) => setFormTimezone(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                    >
                      <option>Africa/Nairobi</option>
                      <option>Africa/Kampala</option>
                      <option>Africa/Dar_es_Salaam</option>
                      <option>Africa/Kigali</option>
                      <option>UTC</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-sm p-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formFeatured}
                      onChange={(e) => setFormFeatured(e.target.checked)}
                      className="accent-blue-950"
                    />
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[13px] text-slate-700">Feature this post on the blog home</span>
                  </label>
                </div>
              )}
            </div>

            <aside className="w-full lg:w-80 bg-slate-50 p-3 overflow-y-auto space-y-3 text-[13px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200">
              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
                <p className="font-medium text-slate-900 border-b border-slate-100 pb-2">Taxonomy</p>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
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
                    {authors.map((a) => (
                      <option key={a.id} value={a.name}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {tags.slice(0, 6).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          setFormTags((prev) => {
                            const current = prev.split(',').map((x) => x.trim()).filter(Boolean);
                            if (current.includes(t.name)) return prev;
                            return current.length ? `${current.join(', ')}, ${t.name}` : t.name;
                          })
                        }
                        className="bg-slate-100 text-slate-600 border border-slate-200 text-[13px] px-2 py-0.5 rounded-sm hover:bg-slate-200 transition"
                      >
                        + {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-1 text-[13px]">
                <p className="font-medium text-slate-700">Summary</p>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Words</span>
                  <span className="font-medium text-slate-900">{formContent.split(/\s+/).filter(Boolean).length}</span>
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

      {postToDelete && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={() => setPostToDelete(null)}>
          <div className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl text-center space-y-3 text-[13px]" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-sm bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Delete blog post?</h3>
              <p className="text-slate-500 mt-1">
                Remove <span className="font-medium text-slate-800">"{postToDelete.title}"</span>? This cannot be undone.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button onClick={() => setPostToDelete(null)} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-sm text-[13px]">Delete</button>
            </div>
          </div>
        </div>
      )}

      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={() => setIsCategoryModalOpen(false)}>
          <div className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl space-y-3 text-[13px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-slate-900">{editingCategory ? 'Edit category' : 'New category'}</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Name</label>
              <input type="text" value={catName} onChange={(e) => setCatName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950" />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Description</label>
              <textarea rows={2} value={catDesc} onChange={(e) => setCatDesc(e.target.value)} className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setIsCategoryModalOpen(false)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]">Cancel</button>
              <button onClick={saveCategory} className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]">Save</button>
            </div>
          </div>
        </div>
      )}

      {isTagModalOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={() => setIsTagModalOpen(false)}>
          <div className="bg-white border border-slate-200 rounded-sm max-w-sm w-full p-3 shadow-xl space-y-3 text-[13px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-slate-900">{editingTag ? 'Edit tag' : 'New tag'}</h3>
              <button onClick={() => setIsTagModalOpen(false)} className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Tag name</label>
              <input type="text" value={tagName} onChange={(e) => setTagName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setIsTagModalOpen(false)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]">Cancel</button>
              <button onClick={saveTag} className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]">Save</button>
            </div>
          </div>
        </div>
      )}

      {isAuthorModalOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={() => setIsAuthorModalOpen(false)}>
          <div className="bg-white border border-slate-200 rounded-sm max-w-lg w-full p-3 shadow-xl space-y-3 text-[13px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-slate-900">{editingAuthor ? 'Edit author' : 'New author'}</h3>
              <button onClick={() => setIsAuthorModalOpen(false)} className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Name</label>
                <input type="text" value={authName} onChange={(e) => setAuthName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950" />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Email</label>
                <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950" />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 mb-1">Role</label>
                <input type="text" value={authRole} onChange={(e) => setAuthRole(e.target.value)} placeholder="e.g. Product Reviewer" className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950" />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 mb-1">Bio</label>
                <textarea rows={3} value={authBio} onChange={(e) => setAuthBio(e.target.value)} className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setIsAuthorModalOpen(false)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]">Cancel</button>
              <button onClick={saveAuthor} className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
        <p className={`text-[15px] font-bold text-slate-900 mt-0.5 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
      <span className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${tint}`}>{icon}</span>
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