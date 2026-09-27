'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import AddCategoryModal from '@/components/admin/AddCategoryModal';

type CategoryStatus = 'Active' | 'Inactive';

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
  children?: Category[];
}

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
    children: [
      { id: 'cat-1-1', name: 'Smartphones & 5G', slug: 'smartphones-5g', parentId: 'cat-1', productsCount: 15, status: 'Active', image: '/phone.jpeg', displayOrder: 1, description: 'Latest 5G mobile smartphones.' },
      { id: 'cat-1-2', name: 'Laptops & Workstations', slug: 'laptops-workstations', parentId: 'cat-1', productsCount: 12, status: 'Active', image: '/Lenovo.jpeg', displayOrder: 2, description: 'High-performance laptops.' },
      { id: 'cat-1-3', name: 'Displays & Monitors', slug: 'displays-monitors', parentId: 'cat-1', productsCount: 15, status: 'Active', image: '/dellmonitor.jpeg', displayOrder: 3, description: '4K and UltraWide monitors.' },
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
    children: [
      { id: 'cat-2-1', name: 'Keyboards & Mice', slug: 'keyboards-mice', parentId: 'cat-2', productsCount: 20, status: 'Active', image: '/phone.jpeg', displayOrder: 1, description: 'Mechanical keyboards and wireless mice.' },
      { id: 'cat-2-2', name: 'Audio & Headphones', slug: 'audio-headphones', parentId: 'cat-2', productsCount: 18, status: 'Active', image: '/phone.jpeg', displayOrder: 2, description: 'Noise-cancelling headphones and speakers.' },
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
  },
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openKebabId, setOpenKebabId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({ 'cat-1': true, 'cat-2': true });

  const [addOpen, setAddOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

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
      // Update existing (simple — moves won't re-parent here, keep flat)
      setCategories((prev) =>
        prev.map((c) =>
          c.id === data.id
            ? { ...c, ...data, id: data.id } as Category
            : { ...c, children: c.children?.map((ch) => (ch.id === data.id ? ({ ...ch, ...data, id: data.id } as Category) : ch)) }
        )
      );
    } else {
      const newCat: Category = {
        id: `cat-${Date.now()}`,
        ...data,
        productsCount: 0,
      } as Category;
      if (newCat.parentId) {
        setCategories((prev) =>
          prev.map((c) => (c.id === newCat.parentId ? { ...c, children: [...(c.children || []), newCat] } : c))
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

  const filtered = categories.filter((c) => {
    const q = searchQuery.toLowerCase();
    const parentMatch = !q || c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
    const childMatch = c.children?.some((ch) => ch.name.toLowerCase().includes(q));
    return parentMatch || childMatch;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Categories</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Organize your product catalog hierarchy</p>
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

        {/* SEARCH */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search categories…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>
          <span className="text-[13px] font-medium text-slate-500 hidden sm:inline">
            Total: {totalCount} categories
          </span>
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
                  <th className="py-2 px-3 font-medium text-center">Products</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="w-12 h-12 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center">
                          <FolderTree className="w-6 h-6" />
                        </span>
                        <h3 className="text-[15px] font-semibold text-slate-900">No categories yet</h3>
                        <p className="text-[13px] text-slate-500 max-w-xs">
                          Create your first category to organize your catalog.
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
                                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                </button>
                              ) : (
                                <span className="w-5" />
                              )}
                              <img
                                src={cat.image}
                                alt={cat.name}
                                className="w-7 h-7 rounded-sm object-cover border border-slate-200 shrink-0"
                              />
                              <span className="font-medium text-slate-900">{cat.name}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-500">{cat.slug}</td>
                          <td className="py-2 px-3 text-slate-400 italic">Root</td>
                          <td className="py-2 px-3 text-center">
                            <span className="bg-slate-100 px-2 py-0.5 rounded-sm font-medium text-slate-800">
                              {cat.productsCount}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${
                                cat.status === 'Active'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {cat.status}
                            </span>
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
                                onDelete={() => {
                                  setOpenKebabId(null);
                                  setDeleteCategoryId(cat.id);
                                }}
                              />
                            )}
                          </td>
                        </tr>

                        {hasChildren && isExpanded &&
                          cat.children?.map((child) => {
                            const childMenuOpen = openKebabId === child.id;
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
                                  <span className="bg-slate-100 px-2 py-0.5 rounded-sm font-medium text-slate-800">
                                    {child.productsCount}
                                  </span>
                                </td>
                                <td className="py-2 px-3">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${
                                      child.status === 'Active'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                  >
                                    {child.status}
                                  </span>
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
              Products in this category will become uncategorized. This cannot be undone.
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

/* ---------- Kebab menu ---------- */
function KebabMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full mt-1 right-0 w-44 bg-white border border-slate-200 rounded-sm shadow-lg z-50 py-1"
    >
      <button
        onClick={onEdit}
        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 text-left transition"
      >
        <Edit className="w-3.5 h-3.5 text-slate-400" />
        Edit
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
