'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  AlertTriangle,
  LayoutGrid,
  List,
  Globe,
  Building2,
} from 'lucide-react';
import AddBrandModal from '@/components/admin/AddBrandModal';

type BrandStatus = 'Active' | 'Inactive';
type ViewMode = 'grid' | 'list';

interface Brand {
  id: string;
  name: string;
  slug: string;
  logo: string;
  productsCount: number;
  status: BrandStatus;
  description?: string;
  websiteUrl?: string;
}

const INITIAL_BRANDS: Brand[] = [
  { id: 'brand-1', name: 'Lenovo', slug: 'lenovo', logo: '/Lenovo.jpeg', productsCount: 24, status: 'Active', description: 'Global technology leader in PCs, laptops, and smart infrastructure.', websiteUrl: 'https://www.lenovo.com' },
  { id: 'brand-2', name: 'Dell Technologies', slug: 'dell-technologies', logo: '/dellmonitor.jpeg', productsCount: 19, status: 'Active', description: 'Enterprise workstations, monitors, and cloud computing hardware.', websiteUrl: 'https://www.dell.com' },
  { id: 'brand-3', name: 'Apple', slug: 'apple', logo: '/phone.jpeg', productsCount: 35, status: 'Active', description: 'Premium consumer electronics and professional silicon devices.', websiteUrl: 'https://www.apple.com' },
  { id: 'brand-4', name: 'Samsung', slug: 'samsung', logo: '/phone.jpeg', productsCount: 28, status: 'Active', description: 'Global leader in mobile displays and memory hardware.', websiteUrl: 'https://www.samsung.com' },
  { id: 'brand-5', name: 'Logitech', slug: 'logitech', logo: '/phone.jpeg', productsCount: 14, status: 'Active', description: 'Peripherals for productivity, gaming, and collaboration.', websiteUrl: 'https://www.logitech.com' },
  { id: 'brand-6', name: 'Legacy Hardware Co.', slug: 'legacy-hardware', logo: '/Lenovo.jpeg', productsCount: 3, status: 'Inactive', description: 'Archived legacy accessories and deprecated component lines.', websiteUrl: 'https://legacy-hardware-example.com' },
];

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>(INITIAL_BRANDS);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const [openKebabId, setOpenKebabId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [deleteBrandId, setDeleteBrandId] = useState<string | null>(null);

  // Close kebab on outside click
  useEffect(() => {
    const onDoc = () => setOpenKebabId(null);
    if (openKebabId) document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [openKebabId]);

  const handleSave = (data: Omit<Brand, 'id' | 'productsCount'> & { id?: string }) => {
    if (data.id) {
      setBrands((prev) => prev.map((b) => (b.id === data.id ? ({ ...b, ...data, id: data.id } as Brand) : b)));
    } else {
      const newBrand: Brand = {
        id: `brand-${Date.now()}`,
        ...data,
        productsCount: 0,
      } as Brand;
      setBrands((prev) => [newBrand, ...prev]);
    }
  };

  const confirmDelete = () => {
    if (!deleteBrandId) return;
    setBrands((prev) => prev.filter((b) => b.id !== deleteBrandId));
    setDeleteBrandId(null);
  };

  const filtered = brands.filter((b) => {
    const q = searchQuery.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      b.slug.toLowerCase().includes(q) ||
      (b.description ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Brands</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Manage manufacturer partnerships and brand listings</p>
          </div>
          <button
            onClick={() => {
              setEditingBrand(null);
              setAddOpen(true);
            }}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add brand</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* TOOLBAR */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="relative w-full sm:w-96">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search brands…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium text-slate-500 hidden sm:inline">
              {filtered.length} of {brands.length}
            </span>
            <div className="inline-flex bg-slate-100 p-0.5 rounded-sm border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-sm transition ${viewMode === 'grid' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-sm transition ${viewMode === 'list' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* EMPTY STATE */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-sm py-16 px-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <span className="w-12 h-12 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </span>
              <h3 className="text-[15px] font-semibold text-slate-900">No brands found</h3>
              <p className="text-[13px] text-slate-500 max-w-sm">
                {searchQuery
                  ? `No brands match "${searchQuery}". Try a different keyword.`
                  : 'Create your first manufacturer or product brand.'}
              </p>
              <button
                onClick={() => {
                  setEditingBrand(null);
                  setAddOpen(true);
                }}
                className="mt-1 inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                <Plus className="w-3.5 h-3.5" />
                Add brand
              </button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((brand) => {
              const isKebabOpen = openKebabId === brand.id;

              return (
                <div
                  key={brand.id}
                  className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col justify-between gap-2 relative"
                >
                  {/* Top row: logo + kebab */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-14 h-14 rounded-sm bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      <img src={brand.logo} alt={brand.name} className="w-full h-full object-cover" />
                    </div>

                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenKebabId(isKebabOpen ? null : brand.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-900 rounded-sm hover:bg-slate-100 transition"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {isKebabOpen && (
                        <KebabMenu
                          onEdit={() => {
                            setOpenKebabId(null);
                            setEditingBrand(brand);
                          }}
                          onDelete={() => {
                            setOpenKebabId(null);
                            setDeleteBrandId(brand.id);
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[13px] font-medium text-slate-900 truncate">{brand.name}</h3>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-sm font-medium text-[13px] border shrink-0 ${
                          brand.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {brand.status}
                      </span>
                    </div>
                    <p className="text-[13px] text-slate-500 line-clamp-2 leading-relaxed">
                      {brand.description || 'No description.'}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[13px]">
                    <span className="font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-sm">
                      {brand.productsCount} products
                    </span>
                    {brand.websiteUrl && (
                      <a
                        href={brand.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-950 hover:text-blue-800 p-1 rounded-sm hover:bg-blue-50 transition"
                        title={brand.websiteUrl}
                      >
                        <Globe className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2 px-3 font-medium">Brand</th>
                    <th className="py-2 px-3 font-medium">Slug</th>
                    <th className="py-2 px-3 font-medium">Website</th>
                    <th className="py-2 px-3 font-medium text-center">Products</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((brand) => {
                    const isKebabOpen = openKebabId === brand.id;

                    return (
                      <tr key={brand.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <img
                              src={brand.logo}
                              alt={brand.name}
                              className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="font-medium text-slate-900 block truncate">{brand.name}</span>
                              <span className="text-[13px] text-slate-400 truncate block max-w-xs">
                                {brand.description}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500">{brand.slug}</td>
                        <td className="py-2 px-3">
                          {brand.websiteUrl ? (
                            <a
                              href={brand.websiteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-950 hover:underline inline-flex items-center gap-1"
                            >
                              <Globe className="w-3 h-3 text-slate-400" />
                              <span className="truncate max-w-[150px]">
                                {brand.websiteUrl.replace(/^https?:\/\//, '')}
                              </span>
                            </a>
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="bg-slate-100 px-2 py-0.5 rounded-sm font-medium text-slate-800">
                            {brand.productsCount}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${
                              brand.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {brand.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenKebabId(isKebabOpen ? null : brand.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-900 rounded-sm hover:bg-slate-100 transition"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {isKebabOpen && (
                            <KebabMenu
                              onEdit={() => {
                                setOpenKebabId(null);
                                setEditingBrand(brand);
                              }}
                              onDelete={() => {
                                setOpenKebabId(null);
                                setDeleteBrandId(brand.id);
                              }}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ADD / EDIT MODAL */}
      <AddBrandModal
        open={addOpen || editingBrand !== null}
        initial={editingBrand}
        onClose={() => {
          setAddOpen(false);
          setEditingBrand(null);
        }}
        onSave={handleSave}
      />

      {/* DELETE CONFIRM */}
      {deleteBrandId && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setDeleteBrandId(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-sm bg-red-50 text-red-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <h3 className="text-[15px] font-semibold text-slate-900">Delete brand?</h3>
            </div>
            <p className="text-[13px] text-slate-500 mt-2">
              Products associated with this brand will remain but lose their brand assignment.
            </p>
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setDeleteBrandId(null)}
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
      className="absolute top-full mt-1 right-0 w-40 bg-white border border-slate-200 rounded-sm shadow-lg z-50 py-1"
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