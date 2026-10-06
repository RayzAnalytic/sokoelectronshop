'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Search, MoreVertical, Edit, Trash2, ChevronDown, ChevronRight,
  AlertTriangle, GripVertical, FolderTree, Globe, Save, X, Eye, EyeOff,
  Layers, Upload, Loader2,
} from 'lucide-react';
import AddCategoryModal from '@/components/admin/AddCategoryModal';
import BulkCategoryUploadModal, {
  type ImportedCategory,
} from '@/components/admin/BulkCategoryUploadModal';
import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
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

interface ApiCategory {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  productsCount: number;
  status: 'Active' | 'Inactive';
  image: string | null;
  displayOrder: number;
  description: string;
  seo: SEOMetadata;
  is_active: boolean;
  icon_name: string;
  children?: ApiCategory[];
}

/**
 * Local view of the admin categories API. Casting `adminApi.categories`
 * to this interface keeps the page compiling even if `lib/admin-api.ts`
 * hasn't been updated yet.
 */
interface CategoriesApi {
  list: (signal?: AbortSignal) => Promise<ApiCategory[]>;
  create: (payload: Record<string, unknown>) => Promise<ApiCategory>;
  update: (
    id: string,
    payload: Record<string, unknown>,
  ) => Promise<ApiCategory>;
  remove: (id: string) => Promise<void>;
}

const DEFAULT_SEO: SEOMetadata = {
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
  canonicalUrl: '',
};

// ─────────────────────────────────────────────────────────────────────────────
// API ↔ local shape
// ─────────────────────────────────────────────────────────────────────────────
function apiToCategory(api: ApiCategory): Category {
  return {
    id: String(api.id),
    name: api.name,
    slug: api.slug,
    parentId: api.parent_id !== null ? String(api.parent_id) : null,
    productsCount: api.productsCount ?? 0,
    status: api.status,
    image: api.image || '/placeholder.jpeg',
    displayOrder: api.displayOrder ?? 0,
    description: api.description || '',
    seo: api.seo || DEFAULT_SEO,
    children: api.children?.map(apiToCategory) ?? [],
  };
}

function categoryToApi(
  data: Partial<Category>,
  existingSeo?: SEOMetadata,
): Record<string, unknown> {
  const parentId = data.parentId ? Number(data.parentId) : null;
  const seo = data.seo ?? existingSeo ?? DEFAULT_SEO;

  return {
    name: data.name ?? '',
    parent_id: parentId,
    description: data.description ?? '',
    image:
      data.image && data.image !== '/placeholder.jpeg'
        ? data.image
        : undefined,
    is_active: (data.status ?? 'Active') === 'Active',
    sort_order: data.displayOrder ?? 0,
    seo: {
      metaTitle: seo.metaTitle || '',
      metaDescription: seo.metaDescription || '',
      metaKeywords: seo.metaKeywords || '',
      canonicalUrl: seo.canonicalUrl || '',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tree helpers
// ─────────────────────────────────────────────────────────────────────────────
function walkTree(
  nodes: Category[],
  visit: (node: Category, parent?: Category) => void,
): void {
  const stack: { node: Category; parent?: Category }[] = nodes.map((n) => ({
    node: n,
  }));

  while (stack.length > 0) {
    const { node, parent } = stack.pop()!;
    visit(node, parent);
    if (node.children?.length) {
      for (const child of node.children) {
        stack.push({ node: child, parent: node });
      }
    }
  }
}

function findNode(nodes: Category[], id: string): Category | null {
  const stack: Category[] = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.id === id) return node;
    if (node.children?.length) stack.push(...node.children);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openKebabId, setOpenKebabId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState<'displayOrder' | 'name' | 'products'>(
    'displayOrder',
  );

  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [seoDrawer, setSeoDrawer] = useState<Category | null>(null);
  const [toast, setToast] = useState('');

  // Cast the API object to our local interface once. Every call below uses
  // this reference so the page compiles no matter how `lib/admin-api.ts` is
  // currently typed.
  const categoriesApi = adminApi.categories as unknown as CategoriesApi;

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // ── Load + refresh ──
  const refresh = useCallback(async () => {
    try {
      const rows = await categoriesApi.list();
      setCategories(rows.map(apiToCategory));
      setLoadError('');
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.message || 'Could not load categories.'
          : 'Could not load categories.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [categoriesApi]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Close kebab on outside click
  useEffect(() => {
    const onDoc = () => setOpenKebabId(null);
    if (openKebabId) document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [openKebabId]);

  const toggleExpand = (id: string) =>
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleSelectRow = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );

  const totalCount = useMemo(() => {
    let n = 0;
    walkTree(categories, () => {
      n++;
    });
    return n;
  }, [categories]);

  const subcategoryCount = useMemo(() => {
    let n = 0;
    walkTree(categories, (node) => {
      if (node.parentId) n++;
    });
    return n;
  }, [categories]);

  const parentOptions = useMemo(() => {
    const editingId = editingCategory?.id ?? null;
    const opts: { id: string; name: string }[] = [];

    walkTree(categories, (node) => {
      if (node.id === editingId) return;
      opts.push({
        id: node.id,
        name: node.parentId ? `— ${node.name}` : node.name,
      });
    });

    return opts;
  }, [categories, editingCategory]);

  // ── Create / update ──
  const handleSave = async (
    data: Partial<Omit<Category, 'id'>> & { id?: string },
  ) => {
    if (saving) return;
    setSaving(true);

    try {
      if (data.id) {
        const existing = findNode(categories, data.id);
        const payload = categoryToApi(data, existing?.seo);
        await categoriesApi.update(data.id, payload);
        await refresh();
        flash('Category updated.');
      } else {
        const payload = categoryToApi(data);
        await categoriesApi.create(payload);
        await refresh();
        flash('Category created.');
      }
      setAddOpen(false);
      setEditingCategory(null);
    } catch (err) {
      flash(
        err instanceof ApiError
          ? err.message || 'Could not save category.'
          : 'Could not save category.',
      );
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const confirmDelete = async () => {
    if (!deleteCategoryId) return;
    const id = deleteCategoryId;
    setDeleteCategoryId(null);

    const previous = categories;
    const strip = (list: Category[]): Category[] =>
      list
        .filter((c) => c.id !== id)
        .map((c) => ({
          ...c,
          children: c.children ? strip(c.children) : [],
        }));
    setCategories(strip(categories));

    try {
      await categoriesApi.remove(id);
      flash('Category deleted.');
    } catch (err) {
      setCategories(previous);
      flash(
        err instanceof ApiError
          ? err.message || 'Could not delete category.'
          : 'Could not delete category.',
      );
    }
  };

  // ── Toggle status ──
  const toggleStatus = async (id: string) => {
    const node = findNode(categories, id);
    if (!node) return;

    const nextStatus: CategoryStatus =
      node.status === 'Active' ? 'Inactive' : 'Active';

    const previous = categories;
    const apply = (list: Category[]): Category[] =>
      list.map((c) =>
        c.id === id
          ? { ...c, status: nextStatus }
          : { ...c, children: c.children ? apply(c.children) : [] },
      );
    setCategories(apply(categories));

    try {
      await categoriesApi.update(id, {
        is_active: nextStatus === 'Active',
        status: nextStatus,
      });
    } catch (err) {
      setCategories(previous);
      flash(
        err instanceof ApiError
          ? err.message || 'Could not update status.'
          : 'Could not update status.',
      );
    }
  };

  // ── SEO ──
  const updateSeo = useCallback(
    async (id: string, seo: SEOMetadata) => {
      const node = findNode(categories, id);
      if (!node) return;

      setSaving(true);
      try {
        await categoriesApi.update(id, { seo });
        await refresh();
        setSeoDrawer(null);
        flash('SEO saved.');
      } catch (err) {
        flash(
          err instanceof ApiError
            ? err.message || 'Could not save SEO.'
            : 'Could not save SEO.',
        );
      } finally {
        setSaving(false);
      }
    },
    [categories, categoriesApi, refresh],
  );

  // Wrapper that reads the current `seoDrawer` at call time. This is what
  // avoids the "seoDrawer is possibly null" error inside inline callbacks.
  const handleSeoSave = useCallback(
    async (seo: SEOMetadata) => {
      if (!seoDrawer) return;
      await updateSeo(seoDrawer.id, seo);
    },
    [seoDrawer, updateSeo],
  );

  // ── Bulk import ──
  const handleBulkImport = async (rows: ImportedCategory[]) => {
    if (rows.length === 0) return;
    setSaving(true);

    const lookup = new Map<string, string>();
    walkTree(categories, (n) => {
      lookup.set(n.name.toLowerCase(), n.id);
      lookup.set(n.slug, n.id);
    });

    // Parents before children so parentName resolves.
    const ordered = [...rows].sort((a, b) => {
      const aHasParent = a.parentName ? 1 : 0;
      const bHasParent = b.parentName ? 1 : 0;
      return aHasParent - bHasParent;
    });

    let succeeded = 0;
    let failed = 0;

    for (const row of ordered) {
      const parentId = row.parentName
        ? lookup.get(row.parentName.toLowerCase()) ?? null
        : null;

      const payload: Record<string, unknown> = {
        name: row.name,
        slug: row.slug,
        parent_id: parentId ? Number(parentId) : null,
        description: row.description,
        image:
          row.image && row.image !== '/placeholder.jpeg'
            ? row.image
            : undefined,
        is_active: row.status === 'Active',
        sort_order: row.displayOrder,
        seo: {
          metaTitle: row.name,
          metaDescription: row.description || '',
          metaKeywords: '',
          canonicalUrl: `/categories/${row.slug}`,
        },
      };

      try {
        const created = await categoriesApi.create(payload);
        const createdId = String(created.id);
        lookup.set(row.name.toLowerCase(), createdId);
        lookup.set(row.slug, createdId);
        succeeded++;
      } catch {
        failed++;
      }
    }

    await refresh();
    setBulkOpen(false);
    setSaving(false);

    if (failed === 0) {
      flash(`Imported ${succeeded} categor${succeeded === 1 ? 'y' : 'ies'}.`);
    } else {
      flash(`Imported ${succeeded}; ${failed} failed.`);
    }
  };

  // ── Filter + sort ──
  const filtered = useMemo((): Category[] => {
    const q = searchQuery.toLowerCase();

    const matches = (c: Category): boolean =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q);

    const sortChildren = (list: Category[]): Category[] =>
      [...list]
        .map((c) => ({
          ...c,
          children: c.children ? sortChildren(c.children) : [],
        }))
        .sort((a, b) => {
          if (sortBy === 'displayOrder') return a.displayOrder - b.displayOrder;
          if (sortBy === 'name') return a.name.localeCompare(b.name);
          if (sortBy === 'products') return b.productsCount - a.productsCount;
          return 0;
        });

    const hasMatchDeep = (c: Category): boolean => {
      if (matches(c)) return true;
      if (!c.children) return false;
      return c.children.some(hasMatchDeep);
    };

    return categories
      .filter(hasMatchDeep)
      .map((c) => ({
        ...c,
        children: c.children
          ? sortChildren(c.children.filter(hasMatchDeep))
          : [],
      }))
      .sort((a, b) => {
        if (sortBy === 'displayOrder') return a.displayOrder - b.displayOrder;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'products') return b.productsCount - a.productsCount;
        return 0;
      });
  }, [categories, searchQuery, sortBy]);

  const activeCount = useMemo(() => {
    let n = 0;
    walkTree(categories, (node) => {
      if (node.status === 'Active') n++;
    });
    return n;
  }, [categories]);

  const inactiveCount = totalCount - activeCount;

  const existingCategoryRefs = useMemo(() => {
    const out: { name: string; slug: string }[] = [];
    walkTree(categories, (n) => {
      out.push({ name: n.name, slug: n.slug });
    });
    return out;
  }, [categories]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">
              Categories
            </h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              {isLoading
                ? 'Loading…'
                : `Organize your catalog hierarchy · ${totalCount} categories`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkOpen(true)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] transition disabled:opacity-60"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bulk upload</span>
              <span className="sm:hidden">Bulk</span>
            </button>
            <button
              onClick={() => {
                setEditingCategory(null);
                setAddOpen(true);
              }}
              disabled={saving}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition disabled:opacity-60"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add category</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">
        {loadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm text-[13px] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {loadError}
          </div>
        )}

        {/* SUMMARY */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            {
              label: 'Total Categories',
              value: totalCount,
              icon: FolderTree,
              color: 'text-blue-950 bg-blue-50',
            },
            {
              label: 'Active',
              value: activeCount,
              icon: Eye,
              color: 'text-emerald-700 bg-emerald-50',
            },
            {
              label: 'Inactive',
              value: inactiveCount,
              icon: EyeOff,
              color: 'text-slate-600 bg-slate-100',
            },
            {
              label: 'Subcategories',
              value: subcategoryCount,
              icon: Layers,
              color: 'text-indigo-700 bg-indigo-50',
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white border border-slate-200 rounded-sm p-2 space-y-1.5"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-6 h-6 rounded-sm flex items-center justify-center ${s.color}`}
                >
                  <s.icon className="w-3.5 h-3.5" />
                </span>
                <span className="text-[13px] font-medium text-slate-500 truncate">
                  {s.label}
                </span>
              </div>
              <div className="text-[15px] font-bold text-slate-900">
                {s.value}
              </div>
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
            <span className="text-[13px] font-medium text-slate-500 hidden sm:inline">
              Sort:
            </span>
            {(['displayOrder', 'name', 'products'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                className={`px-2.5 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${sortBy === opt
                    ? 'bg-blue-50 border border-blue-950 text-blue-950'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
              >
                {opt === 'displayOrder'
                  ? 'Order'
                  : opt === 'name'
                    ? 'Name'
                    : 'Products'}
              </button>
            ))}
          </div>
        </div>

        {/* LOADING / TABLE */}
        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-sm p-12 text-center text-slate-500 text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
            Loading categories…
          </div>
        ) : (
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
                        checked={
                          selectedIds.length === totalCount && totalCount > 0
                        }
                        onChange={() => {
                          if (selectedIds.length === totalCount) {
                            setSelectedIds([]);
                          } else {
                            const ids: string[] = [];
                            walkTree(categories, (n) => ids.push(n.id));
                            setSelectedIds(ids);
                          }
                        }}
                        className="rounded-sm border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                      />
                    </th>
                    <th className="py-2 px-3 font-medium">Category</th>
                    <th className="py-2 px-3 font-medium">Slug</th>
                    <th className="py-2 px-3 font-medium">Parent</th>
                    <th className="py-2 px-3 font-medium text-center">Order</th>
                    <th className="py-2 px-3 font-medium text-center">
                      Products
                    </th>
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
                          <h3 className="text-[15px] font-semibold text-slate-900">
                            No categories found
                          </h3>
                          <p className="text-[13px] text-slate-500 max-w-xs">
                            {searchQuery
                              ? 'Try a different search term.'
                              : 'Create your first category to organize your catalog.'}
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
                      const seoFilled = !!(
                        cat.seo.metaTitle && cat.seo.metaDescription
                      );

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
                                className="rounded-sm border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
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
                                  <div className="font-medium text-slate-900 truncate">
                                    {cat.name}
                                  </div>
                                  {cat.description && (
                                    <div className="text-[13px] text-slate-400 truncate max-w-[260px]">
                                      {cat.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-500">
                              {cat.slug}
                            </td>
                            <td className="py-2 px-3 text-slate-400 italic">
                              Root
                            </td>
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
                                {cat.status === 'Active' ? (
                                  <Eye className="w-3 h-3" />
                                ) : (
                                  <EyeOff className="w-3 h-3" />
                                )}
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
                                title={
                                  seoFilled ? 'SEO complete' : 'SEO missing'
                                }
                              >
                                <Globe className="w-3 h-3" />
                                {seoFilled ? 'Ready' : 'Missing'}
                              </button>
                            </td>
                            <td className="py-2 px-3 relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenKebabId(
                                    parentMenuOpen ? null : cat.id,
                                  );
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
                              const childMenuOpen =
                                openKebabId === child.id;
                              const childSeoFilled = !!(
                                child.seo.metaTitle &&
                                child.seo.metaDescription
                              );
                              return (
                                <tr
                                  key={child.id}
                                  className="bg-slate-50/40 hover:bg-slate-50 transition-colors"
                                >
                                  <td className="py-2 px-3 text-center text-slate-300">
                                    <GripVertical className="w-4 h-4 mx-auto" />
                                  </td>
                                  <td className="py-2 px-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.includes(
                                        child.id,
                                      )}
                                      onChange={() =>
                                        toggleSelectRow(child.id)
                                      }
                                      className="rounded-sm border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
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
                                      <span className="font-medium text-slate-800">
                                        {child.name}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 font-mono text-slate-500">
                                    {child.slug}
                                  </td>
                                  <td className="py-2 px-3 text-slate-600">
                                    {cat.name}
                                  </td>
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
                                      onClick={() =>
                                        toggleStatus(child.id)
                                      }
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border transition ${child.status === 'Active'
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                        }`}
                                    >
                                      {child.status === 'Active' ? (
                                        <Eye className="w-3 h-3" />
                                      ) : (
                                        <EyeOff className="w-3 h-3" />
                                      )}
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
                                        setOpenKebabId(
                                          childMenuOpen ? null : child.id,
                                        );
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
        )}
      </main>

      <AddCategoryModal
        open={addOpen || editingCategory !== null}
        initial={editingCategory}
        parentOptions={parentOptions}
        onClose={() => {
          if (saving) return;
          setAddOpen(false);
          setEditingCategory(null);
        }}
        onSave={handleSave}
      />

      <BulkCategoryUploadModal
        open={bulkOpen}
        onClose={() => !saving && setBulkOpen(false)}
        onSave={handleBulkImport}
        existingCategories={existingCategoryRefs}
      />

      {seoDrawer && (
        <SEODrawer
          category={seoDrawer}
          onClose={() => !saving && setSeoDrawer(null)}
          onSave={handleSeoSave}
        />
      )}

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
              <h3 className="text-[15px] font-semibold text-slate-900">
                Delete category?
              </h3>
            </div>
            <p className="text-[13px] text-slate-500 mt-2">
              Products in this category will become uncategorized. Subcategories
              will also be removed. This cannot be undone.
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

      {toast && (
        <div className="fixed bottom-4 right-4 z-[110] bg-slate-900 text-white text-[13px] px-4 py-2.5 rounded-sm shadow-lg">
          {toast}
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
  onSave: (seo: SEOMetadata) => void | Promise<void>;
}) {
  const [seo, setSeo] = useState<SEOMetadata>(category.seo || DEFAULT_SEO);

  const slugPreview = category.slug;
  const titlePreview = seo.metaTitle || `${category.name} — Your Store`;
  const descPreview =
    seo.metaDescription ||
    `Browse our selection of ${category.name.toLowerCase()} products.`;

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
        <div className="px-3 py-3 border-b border-slate-200 sticky top-0 bg-white z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-9 h-9 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold text-slate-900 truncate">
                SEO Metadata
              </h3>
              <p className="text-[13px] text-slate-500 truncate">
                {category.name}
              </p>
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
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[13px] font-medium text-slate-700">
                Meta Title
              </label>
              <span
                className={`text-[13px] font-mono ${titleOk ? 'text-emerald-600' : 'text-amber-600'
                  }`}
              >
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

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[13px] font-medium text-slate-700">
                Meta Description
              </label>
              <span
                className={`text-[13px] font-mono ${descOk ? 'text-emerald-600' : 'text-amber-600'
                  }`}
              >
                {descLength}/160
              </span>
            </div>
            <textarea
              value={seo.metaDescription}
              onChange={(e) =>
                setSeo({ ...seo, metaDescription: e.target.value })
              }
              rows={3}
              placeholder={`Browse our selection of ${category.name.toLowerCase()} products.`}
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 resize-none"
            />
            <p className="text-[13px] text-slate-400 mt-1">
              Recommended: 120–160 characters. The snippet shown under the
              title.
            </p>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1">
              Meta Keywords
            </label>
            <input
              type="text"
              value={seo.metaKeywords}
              onChange={(e) =>
                setSeo({ ...seo, metaKeywords: e.target.value })
              }
              placeholder="comma, separated, keywords"
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
            <p className="text-[13px] text-slate-400 mt-1">
              Comma-separated. Low SEO impact but useful for internal search.
            </p>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1">
              Canonical URL
            </label>
            <input
              type="text"
              value={seo.canonicalUrl}
              onChange={(e) =>
                setSeo({ ...seo, canonicalUrl: e.target.value })
              }
              placeholder={`/categories/${slugPreview}`}
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
            <p className="text-[13px] text-slate-400 mt-1">
              The preferred URL for this category page to avoid duplicate
              content.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-1">
            <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
              <Search className="w-3 h-3" />
              Search preview
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-sm p-2">
              <div className="text-[13px] text-emerald-700 truncate">
                yourstore.co.ke
                {seo.canonicalUrl || `/categories/${slugPreview}`}
              </div>
              <div className="text-[15px] text-blue-800 font-medium truncate mt-0.5">
                {titlePreview}
              </div>
              <div className="text-[13px] text-slate-600 line-clamp-2 mt-0.5">
                {descPreview}
              </div>
            </div>
          </div>
        </div>

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