'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  GripVertical,
  FolderTree,
  ArrowUpDown,
  Globe,
  FileText,
  Image as ImageIcon,
  Save,
  X,
  Check,
  Eye,
  EyeOff,
  Layers,
} from 'lucide-react';
import AddCategoryModal from '@/components/admin/AddCategoryModal';

type CategoryStatus = 'Active' | 'Inactive';

interface SEOMetadata {
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  canonicalUrl: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  productsCount: number;
  status: CategoryStatus;
  image: string;
  displayOrder: number;
  description?: string;
  seo: SEOMetadata;
  children?: Category[];
}

const DEFAULT_SEO: SEOMetadata = {
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
  canonicalUrl: '',
};

const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'cat-1',
    name: 'Electronics',
    slug: 'electronics',
    parentId: null,
    productsCount: 42,
    status: 'Active',
    image: '/Lenovo.jpeg',
    displayOrder: 1,
    description: 'All electronic gadgets, computers, and smart devices.',
    seo: {
      metaTitle: 'Electronics — Shop the Latest Tech',
      metaDescription: 'Browse the latest smartphones, laptops, TVs, and accessories at the best prices in Kenya.',
      metaKeywords: 'electronics, smartphones, laptops, TVs, accessories, Kenya',
      canonicalUrl: '/categories/electronics',
    },
    children: [
      {
        id: 'cat-1-1',
        name: 'Phones',
        slug: 'phones',
        parentId: 'cat-1',
        productsCount: 15,
        status: 'Active',
        image: '/phone.jpeg',
        displayOrder: 1,
        description: 'Latest 5G mobile smartphones.',
        seo: {
          metaTitle: 'Phones — 5G Smartphones',
          metaDescription: 'Shop the newest 5G smartphones from Apex, Samsung, and more.',
          metaKeywords: 'phones, smartphones, 5G, mobile',
          canonicalUrl: '/categories/electronics/phones',
        },
      },
      {
        id: 'cat-1-2',
        name: 'Laptops',
        slug: 'laptops',
        parentId: 'cat-1',
        productsCount: 12,
        status: 'Active',
        image: '/Lenovo.jpeg',
        displayOrder: 2,
        description: 'High-performance laptops and workstations.',
        seo: {
          metaTitle: 'Laptops — Workstations & Ultrabooks',
          metaDescription: 'Discover high-performance laptops for work, gaming, and creators.',
          metaKeywords: 'laptops, notebooks, workstations',
          canonicalUrl: '/categories/electronics/laptops',
        },
      },
      {
        id: 'cat-1-3',
        name: 'TVs',
        slug: 'tvs',
        parentId: 'cat-1',
        productsCount: 8,
        status: 'Active',
        image: '/dellmonitor.jpeg',
        displayOrder: 3,
        description: '4K and 8K smart TVs.',
        seo: {
          metaTitle: 'TVs — 4K & 8K Smart TVs',
          metaDescription: 'Upgrade your home entertainment with 4K and 8K smart TVs.',
          metaKeywords: 'TVs, smart TV, 4K, 8K',
          canonicalUrl: '/categories/electronics/tvs',
        },
      },
      {
        id: 'cat-1-4',
        name: 'Accessories',
        slug: 'accessories-electronics',
        parentId: 'cat-1',
        productsCount: 7,
        status: 'Active',
        image: '/phone.jpeg',
        displayOrder: 4,
        description: 'Cables, chargers, and electronic add-ons.',
        seo: {
          metaTitle: 'Electronics Accessories',
          metaDescription: 'Cables, chargers, adapters, and add-ons for your electronics.',
          metaKeywords: 'accessories, cables, chargers, adapters',
          canonicalUrl: '/categories/electronics/accessories',
        },
      },
    ],
  },
  {
    id: 'cat-2',
    name: 'Accessories',
    slug: 'accessories',
    parentId: null,
    productsCount: 38,
    status: 'Active',
    image: '/phone.jpeg',
    displayOrder: 2,
    description: 'Peripherals, mice, keyboards, and audio gear.',
    seo: {
      metaTitle: 'Accessories — Peripherals & Audio',
      metaDescription: 'Shop keyboards, mice, headphones, and other accessories.',
      metaKeywords: 'accessories, keyboards, mice, headphones, audio',
      canonicalUrl: '/categories/accessories',
    },
    children: [
      {
        id: 'cat-2-1',
        name: 'Keyboards & Mice',
        slug: 'keyboards-mice',
        parentId: 'cat-2',
        productsCount: 20,
        status: 'Active',
        image: '/phone.jpeg',
        displayOrder: 1,
        description: 'Mechanical keyboards and wireless mice.',
        seo: {
          metaTitle: 'Keyboards & Mice',
          metaDescription: 'Mechanical keyboards and precision wireless mice.',
          metaKeywords: 'keyboards, mice, mechanical, wireless',
          canonicalUrl: '/categories/accessories/keyboards-mice',
        },
      },
      {
        id: 'cat-2-2',
        name: 'Audio & Headphones',
        slug: 'audio-headphones',
        parentId: 'cat-2',
        productsCount: 18,
        status: 'Active',
        image: '/phone.jpeg',
        displayOrder: 2,
        description: 'Noise-cancelling headphones and speakers.',
        seo: {
          metaTitle: 'Audio & Headphones',
          metaDescription: 'Noise-cancelling headphones, earbuds, and speakers.',
          metaKeywords: 'audio, headphones, earbuds, speakers',
          canonicalUrl: '/categories/accessories/audio-headphones',
        },
      },
    ],
  },
  {
    id: 'cat-3',
    name: 'Furniture & Office',
    slug: 'furniture-office',
    parentId: null,
    productsCount: 8,
    status: 'Active',
    image: '/Lenovo.jpeg',
    displayOrder: 3,
    description: 'Ergonomic chairs and executive desks.',
    seo: {
      metaTitle: 'Furniture & Office',
      metaDescription: 'Ergonomic office chairs and executive desks.',
      metaKeywords: 'furniture, office, chairs, desks',
      canonicalUrl: '/categories/furniture-office',
    },
  },
  {
    id: 'cat-4',
    name: 'Archived Clearance',
    slug: 'archived-clearance',
    parentId: null,
    productsCount: 3,
    status: 'Inactive',
    image: '/phone.jpeg',
    displayOrder: 4,
    description: 'Discontinued clearance stock.',
    seo: {
      metaTitle: 'Archived Clearance',
      metaDescription: 'Discontinued clearance stock at discounted prices.',
      metaKeywords: 'clearance, sale, discontinued',
      canonicalUrl: '/categories/archived-clearance',
    },
  },
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openKebabId, setOpenKebabId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({ 'cat-1': true, 'cat-2': true });
  const [sortBy, setSortBy] = useState<'displayOrder' | 'name' | 'products'>('displayOrder');

  const [addOpen, setAddOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [seoDrawer, setSeoDrawer] = useState<Category | null>(null);

  // Close kebab on outside click
  useEffect(() => {
    const onDoc = () => setOpenKebabId(null);
    if (openKebabId) document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [openKebabId]);

  const toggleExpand = (id: string) => setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleSelectRow = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const totalCount = categories.reduce((acc, c) => acc + 1 + (c.children?.length || 0), 0);

  const parentOptions = categories
    .filter((c) => c.id !== editingCategory?.id)
    .flatMap((c) => {
      const opts = [{ id: c.id, name: c.name }];
      c.children?.forEach((ch) => {
        if (ch.id !== editingCategory?.id) opts.push({ id: ch.id, name: `— ${ch.name}` });
      });
      return opts;
    });

  const handleSave = (data: Omit<Category, 'id' | 'children' | 'productsCount'> & { id?: string }) => {
    if (data.id) {
      // Update existing
      setCategories((prev) =>
        prev.map((c) => {
          if (c.id === data.id) {
            return { ...c, ...data, id: data.id } as Category;
          }
          if (c.children?.some((ch) => ch.id === data.id)) {
            return {
              ...c,
              children: c.children.map((ch) =>
                ch.id === data.id ? ({ ...ch, ...data, id: data.id } as Category) : ch
              ),
            };
          }
          return c;
        })
      );
    } else {
      const newCat: Category = {
        id: `cat-${Date.now()}`,
        ...data,
        productsCount: 0,
        seo: data.seo || DEFAULT_SEO,
      } as Category;
      if (newCat.parentId) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === newCat.parentId ? { ...c, children: [...(c.children || []), newCat] } : c
          )
        );
      } else {
        setCategories((prev) => [...prev, newCat]);
      }
    }
  };

  const confirmDelete = () => {
    if (!deleteCategoryId) return;
    setCategories((prev) =>
      prev
        .filter((c) => c.id !== deleteCategoryId)
        .map((c) => ({ ...c, children: c.children?.filter((ch) => ch.id !== deleteCategoryId) }))
    );
    setDeleteCategoryId(null);
  };

  const toggleStatus = (id: string) => {
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return { ...c, status: c.status === 'Active' ? 'Inactive' : 'Active' } as Category;
        }
        if (c.children?.some((ch) => ch.id === id)) {
          return {
            ...c,
            children: c.children.map((ch) =>
              ch.id === id
                ? ({ ...ch, status: ch.status === 'Active' ? 'Inactive' : 'Active' } as Category)
                : ch
            ),
          };
        }
        return c;
      })
    );
  };

  const updateSeo = (id: string, seo: SEOMetadata) => {
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id === id) return { ...c, seo };
        if (c.children?.some((ch) => ch.id === id)) {
          return {
            ...c,
            children: c.children.map((ch) => (ch.id === id ? { ...ch, seo } : ch)),
          };
        }
        return c;
      })
    );
    if (seoDrawer && seoDrawer.id === id) {
      setSeoDrawer({ ...seoDrawer, seo });
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return categories
      .filter((c) => {
        const parentMatch = !q || c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
        const childMatch = c.children?.some(
          (ch) => ch.name.toLowerCase().includes(q) || ch.slug.toLowerCase().includes(q)
        );
        return parentMatch || childMatch;
      })
      .map((c) => ({
        ...c,
        children: c.children
          ?.filter((ch) => {
            if (!q) return true;
            const parentMatch = c.name.toLowerCase().includes(q);
            const childMatch = ch.name.toLowerCase().includes(q) || ch.slug.toLowerCase().includes(q);
            return parentMatch || childMatch;
          })
          .sort((a, b) => {
            if (sortBy === 'displayOrder') return a.displayOrder - b.displayOrder;
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'products') return b.productsCount - a.productsCount;
            return 0;
          }),
      }))
      .sort((a, b) => {
        if (sortBy === 'displayOrder') return a.displayOrder - b.displayOrder;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'products') return b.productsCount - a.productsCount;
        return 0;
      });
  }, [categories, searchQuery, sortBy]);

  const activeCount = categories.filter((c) => c.status === 'Active').length;
  const inactiveCount = categories.filter((c) => c.status === 'Inactive').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Categories</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Organize your product catalog hierarchy · {totalCount} categories
            </p>
          </div>
          <button
            onClick={() => {
              setEditingCategory(null);
              setAddOpen(true);
            }}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add category</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Total Categories', value: totalCount, icon: FolderTree, color: 'text-blue-950 bg-blue-50' },
            { label: 'Active', value: activeCount, icon: Eye, color: 'text-emerald-700 bg-emerald-50' },
            { label: 'Inactive', value: inactiveCount, icon: EyeOff, color: 'text-slate-600 bg-slate-100' },
            { label: 'Subcategories', value: categories.reduce((a, c) => a + (c.children?.length || 0), 0), icon: Layers, color: 'text-indigo-700 bg-indigo-50' },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-sm p-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className={`w-6 h-6 rounded-sm flex items-center justify-center ${s.color}`}>
                  <s.icon className="w-3.5 h-3.5" />
                </span>
                <span className="text-[13px] font-medium text-slate-500 truncate">{s.label}</span>
              </div>
              <div className="text-[15px] font-bold text-slate-900">{s.value}</div>
            </div>
          ))}
        </div>

        {/* SEARCH + SORT */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search categories by name or slug…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-medium text-slate-500 hidden sm:inline">Sort:</span>
            {(['displayOrder', 'name', 'products'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                className={`px-2.5 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${sortBy === opt
                    ? 'bg-blue-50 border border-blue-950 text-blue-950'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
              >
                {opt === 'displayOrder' ? 'Order' : opt === 'name' ? 'Name' : 'Products'}
              </button>
            ))}
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2 px-3 w-8 text-center">
                    <GripVertical className="w-3.5 h-3.5 mx-auto text-slate-300" />
                  </th>
                  <th className="py-2 px-2 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === totalCount && totalCount > 0}
                      onChange={() => {
                        if (selectedIds.length === totalCount) setSelectedIds([]);
                        else {
                          const ids: string[] = [];
                          categories.forEach((c) => {
                            ids.push(c.id);
                            c.children?.forEach((ch) => ids.push(ch.id));
                          });
                          setSelectedIds(ids);
                        }
                      }}
                      className="rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                    />
                  </th>
                  <th className="py-2 px-3 font-medium">Category</th>
                  <th className="py-2 px-3 font-medium">Slug</th>
                  <th className="py-2 px-3 font-medium">Parent</th>
                  <th className="py-2 px-3 font-medium text-center">Order</th>
                  <th className="py-2 px-3 font-medium text-center">Products</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium text-center">SEO</th>
                  <th className="py-2 px-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="w-12 h-12 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center">
                          <FolderTree className="w-6 h-6" />
                        </span>
                        <h3 className="text-[15px] font-semibold text-slate-900">No categories found</h3>
                        <p className="text-[13px] text-slate-500 max-w-xs">
                          {searchQuery ? 'Try a different search term.' : 'Create your first category to organize your catalog.'}
                        </p>
                        <button
                          onClick={() => {
                            setEditingCategory(null);
                            setAddOpen(true);
                          }}
                          className="mt-1 inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add category
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((cat) => {
                    const hasChildren = (cat.children?.length ?? 0) > 0;
                    const isExpanded = expandedIds[cat.id] ?? true;
                    const parentMenuOpen = openKebabId === cat.id;
                    const seoFilled = !!(cat.seo.metaTitle && cat.seo.metaDescription);

                    return (
                      <React.Fragment key={cat.id}>
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 text-center text-slate-400 cursor-grab">
                            <GripVertical className="w-4 h-4 mx-auto" />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(cat.id)}
                              onChange={() => toggleSelectRow(cat.id)}
                              className="rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              {hasChildren ? (
                                <button
                                  onClick={() => toggleExpand(cat.id)}
                                  className="p-1 text-slate-400 hover:text-slate-900 rounded-sm hover:bg-slate-100 transition"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              ) : (
                                <span className="w-5" />
                              )}
                              <img
                                src={cat.image}
                                alt={cat.name}
                                className="w-7 h-7 rounded-sm object-cover border border-slate-200 shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="font-medium text-slate-900 truncate">{cat.name}</div>
                                {cat.description && (
                                  <div className="text-[13px] text-slate-400 truncate max-w-[260px]">
                                    {cat.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-500">{cat.slug}</td>
                          <td className="py-2 px-3 text-slate-400 italic">Root</td>
                          <td className="py-2 px-3 text-center">
                            <span className="inline-block bg-slate-100 px-2 py-0.5 rounded-sm font-mono text-slate-700">
                              {cat.displayOrder}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="bg-slate-100 px-2 py-0.5 rounded-sm font-medium text-slate-800">
                              {cat.productsCount}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <button
                              onClick={() => toggleStatus(cat.id)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border transition ${cat.status === 'Active'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                }`}
                            >
                              {cat.status === 'Active' ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              {cat.status}
                            </button>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => setSeoDrawer(cat)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border transition ${seoFilled
                                  ? 'bg-blue-50 text-blue-950 border-blue-100 hover:bg-blue-100'
                                  : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100'
                                }`}
                              title={seoFilled ? 'SEO complete' : 'SEO missing'}
                            >
                              <Globe className="w-3 h-3" />
                              {seoFilled ? 'Ready' : 'Missing'}
                            </button>
                          </td>
                          <td className="py-2 px-3 relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenKebabId(parentMenuOpen ? null : cat.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-900 rounded-sm hover:bg-slate-100 transition"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {parentMenuOpen && (
                              <KebabMenu
                                onEdit={() => {
                                  setOpenKebabId(null);
                                  setEditingCategory(cat);
                                }}
                                onEditSeo={() => {
                                  setOpenKebabId(null);
                                  setSeoDrawer(cat);
                                }}
                                onDelete={() => {
                                  setOpenKebabId(null);
                                  setDeleteCategoryId(cat.id);
                                }}
                              />
                            )}
                          </td>
                        </tr>

                        {hasChildren &&
                          isExpanded &&
                          cat.children?.map((child) => {
                            const childMenuOpen = openKebabId === child.id;
                            const childSeoFilled = !!(child.seo.metaTitle && child.seo.metaDescription);
                            return (
                              <tr key={child.id} className="bg-slate-50/40 hover:bg-slate-50 transition-colors">
                                <td className="py-2 px-3 text-center text-slate-300">
                                  <GripVertical className="w-4 h-4 mx-auto" />
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.includes(child.id)}
                                    onChange={() => toggleSelectRow(child.id)}
                                    className="rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <div className="flex items-center gap-2 pl-7">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                    <img
                                      src={child.image}
                                      alt={child.name}
                                      className="w-6 h-6 rounded-sm object-cover border border-slate-200 shrink-0"
                                    />
                                    <span className="font-medium text-slate-800">{child.name}</span>
                                  </div>
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-500">{child.slug}</td>
                                <td className="py-2 px-3 text-slate-600">{cat.name}</td>
                                <td className="py-2 px-3 text-center">
                                  <span className="inline-block bg-slate-100 px-2 py-0.5 rounded-sm font-mono text-slate-700">
                                    {child.displayOrder}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span className="bg-slate-100 px-2 py-0.5 rounded-sm font-medium text-slate-800">
                                    {child.productsCount}
                                  </span>
                                </td>
                                <td className="py-2 px-3">
                                  <button
                                    onClick={() => toggleStatus(child.id)}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border transition ${child.status === 'Active'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                      }`}
                                  >
                                    {child.status === 'Active' ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                    {child.status}
                                  </button>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    onClick={() => setSeoDrawer(child)}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border transition ${childSeoFilled
                                        ? 'bg-blue-50 text-blue-950 border-blue-100 hover:bg-blue-100'
                                        : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100'
                                      }`}
                                  >
                                    <Globe className="w-3 h-3" />
                                    {childSeoFilled ? 'Ready' : 'Missing'}
                                  </button>
                                </td>
                                <td className="py-2 px-3 relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenKebabId(childMenuOpen ? null : child.id);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-slate-900 rounded-sm hover:bg-slate-100 transition"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                  {childMenuOpen && (
                                    <KebabMenu
                                      onEdit={() => {
                                        setOpenKebabId(null);
                                        setEditingCategory(child);
                                      }}
                                      onEditSeo={() => {
                                        setOpenKebabId(null);
                                        setSeoDrawer(child);
                                      }}
                                      onDelete={() => {
                                        setOpenKebabId(null);
                                        setDeleteCategoryId(child.id);
                                      }}
                                    />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ADD / EDIT MODAL */}
      <AddCategoryModal
        open={addOpen || editingCategory !== null}
        initial={editingCategory}
        parentOptions={parentOptions}
        onClose={() => {
          setAddOpen(false);
          setEditingCategory(null);
        }}
        onSave={handleSave}
      />

      {/* SEO DRAWER */}
      {seoDrawer && (
        <SEODrawer
          category={seoDrawer}
          onClose={() => setSeoDrawer(null)}
          onSave={(seo) => {
            updateSeo(seoDrawer.id, seo);
            setSeoDrawer(null);
          }}
        />
      )}

      {/* DELETE CONFIRM */}
      {deleteCategoryId && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setDeleteCategoryId(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-sm bg-red-50 text-red-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <h3 className="text-[15px] font-semibold text-slate-900">Delete category?</h3>
            </div>
            <p className="text-[13px] text-slate-500 mt-2">
              Products in this category will become uncategorized. Subcategories will also be removed. This cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setDeleteCategoryId(null)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-500 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
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

/* ─────────────────────────── SEO Drawer ─────────────────────────── */
function SEODrawer({
  category,
  onClose,
  onSave,
}: {
  category: Category;
  onClose: () => void;
  onSave: (seo: SEOMetadata) => void;
}) {
  const [seo, setSeo] = useState<SEOMetadata>(category.seo || DEFAULT_SEO);

  const slugPreview = category.slug;
  const titlePreview = seo.metaTitle || `${category.name} — Your Store`;
  const descPreview =
    seo.metaDescription || `Browse our selection of ${category.name.toLowerCase()} products.`;

  const titleLength = seo.metaTitle.length;
  const descLength = seo.metaDescription.length;
  const titleOk = titleLength >= 30 && titleLength <= 60;
  const descOk = descLength >= 120 && descLength <= 160;

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border-l border-slate-200 w-full max-w-xl h-full overflow-y-auto shadow-xl flex flex-col"
      >
        {/* Header */}
        <div className="px-3 py-3 border-b border-slate-200 sticky top-0 bg-white z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-9 h-9 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold text-slate-900 truncate">SEO Metadata</h3>
              <p className="text-[13px] text-slate-500 truncate">{category.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 space-y-3">
          {/* Meta Title */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[13px] font-medium text-slate-700">Meta Title</label>
              <span className={`text-[13px] font-mono ${titleOk ? 'text-emerald-600' : 'text-amber-600'}`}>
                {titleLength}/60
              </span>
            </div>
            <input
              type="text"
              value={seo.metaTitle}
              onChange={(e) => setSeo({ ...seo, metaTitle: e.target.value })}
              placeholder={`${category.name} — Your Store`}
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
            <p className="text-[13px] text-slate-400 mt-1">
              Recommended: 30–60 characters. Shown in search results.
            </p>
          </div>

          {/* Meta Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[13px] font-medium text-slate-700">Meta Description</label>
              <span className={`text-[13px] font-mono ${descOk ? 'text-emerald-600' : 'text-amber-600'}`}>
                {descLength}/160
              </span>
            </div>
            <textarea
              value={seo.metaDescription}
              onChange={(e) => setSeo({ ...seo, metaDescription: e.target.value })}
              rows={3}
              placeholder={`Browse our selection of ${category.name.toLowerCase()} products.`}
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 resize-none"
            />
            <p className="text-[13px] text-slate-400 mt-1">
              Recommended: 120–160 characters. The snippet shown under the title.
            </p>
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1">Meta Keywords</label>
            <input
              type="text"
              value={seo.metaKeywords}
              onChange={(e) => setSeo({ ...seo, metaKeywords: e.target.value })}
              placeholder="comma, separated, keywords"
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
            <p className="text-[13px] text-slate-400 mt-1">
              Comma-separated. Low SEO impact but useful for internal search.
            </p>
          </div>

          {/* Canonical URL */}
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1">Canonical URL</label>
            <input
              type="text"
              value={seo.canonicalUrl}
              onChange={(e) => setSeo({ ...seo, canonicalUrl: e.target.value })}
              placeholder={`/categories/${slugPreview}`}
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
            <p className="text-[13px] text-slate-400 mt-1">
              The preferred URL for this category page to avoid duplicate content.
            </p>
          </div>

          {/* Google preview */}
          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-1">
            <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
              <Search className="w-3 h-3" />
              Search preview
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-sm p-2">
              <div className="text-[13px] text-emerald-700 truncate">
                yourstore.co.ke{seo.canonicalUrl || `/categories/${slugPreview}`}
              </div>
              <div className="text-[15px] text-blue-800 font-medium truncate mt-0.5">{titlePreview}</div>
              <div className="text-[13px] text-slate-600 line-clamp-2 mt-0.5">{descPreview}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-slate-200 sticky bottom-0 bg-white flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(seo)}
            className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            Save SEO
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Kebab menu ─────────────────────────── */
function KebabMenu({
  onEdit,
  onEditSeo,
  onDelete,
}: {
  onEdit: () => void;
  onEditSeo: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full mt-1 right-0 w-48 bg-white border border-slate-200 rounded-sm shadow-lg z-50 py-1"
    >
      <button
        onClick={onEdit}
        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 text-left transition"
      >
        <Edit className="w-3.5 h-3.5 text-slate-400" />
        Edit category
      </button>
      <button
        onClick={onEditSeo}
        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 text-left transition"
      >
        <Globe className="w-3.5 h-3.5 text-slate-400" />
        Edit SEO
      </button>
      <div className="border-t border-slate-100 my-1" />
      <button
        onClick={onDelete}
        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 text-left transition"
      >
        <Trash2 className="w-3.5 h-3.5 text-red-500" />
        Delete
      </button>
    </div>
  );
}
