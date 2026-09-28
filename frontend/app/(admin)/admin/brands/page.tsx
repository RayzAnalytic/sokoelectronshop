'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  ExternalLink,
  TrendingUp,
  Package,
  DollarSign,
  Users,
  Eye,
  EyeOff,
  Save,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Star,
  BarChart3,
} from 'lucide-react';
import AddBrandModal from '@/components/admin/AddBrandModal';

type BrandStatus = 'Active' | 'Inactive';
type ViewMode = 'grid' | 'list';

interface SEOMetadata {
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  canonicalUrl: string;
}

interface Brand {
  id: string;
  name: string;
  slug: string;
  logo: string;
  productsCount: number;
  status: BrandStatus;
  description?: string;
  websiteUrl?: string;
  // NEW
  salesTotal: number;
  salesGrowth: number; // percent, can be negative
  customersCount: number;
  featured: boolean;
  seo: SEOMetadata;
}

const DEFAULT_SEO: SEOMetadata = {
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
  canonicalUrl: '',
};

const INITIAL_BRANDS: Brand[] = [
  {
    id: 'brand-1',
    name: 'Lenovo',
    slug: 'lenovo',
    logo: '/Lenovo.jpeg',
    productsCount: 24,
    status: 'Active',
    description: 'Global technology leader in PCs, laptops, and smart infrastructure.',
    websiteUrl: 'https://www.lenovo.com',
    salesTotal: 1250000,
    salesGrowth: 12.4,
    customersCount: 342,
    featured: true,
    seo: {
      metaTitle: 'Lenovo Laptops & PCs — Official Store',
      metaDescription: 'Shop Lenovo ThinkPad, IdeaPad, and Legion laptops with official warranty and fast delivery in Kenya.',
      metaKeywords: 'lenovo, thinkpad, ideapad, legion, laptops, PCs',
      canonicalUrl: '/brands/lenovo',
    },
  },
  {
    id: 'brand-2',
    name: 'Dell Technologies',
    slug: 'dell-technologies',
    logo: '/dellmonitor.jpeg',
    productsCount: 19,
    status: 'Active',
    description: 'Enterprise workstations, monitors, and cloud computing hardware.',
    websiteUrl: 'https://www.dell.com',
    salesTotal: 980000,
    salesGrowth: 8.7,
    customersCount: 218,
    featured: false,
    seo: {
      metaTitle: 'Dell Monitors, Laptops & Workstations',
      metaDescription: 'Explore Dell UltraSharp monitors, XPS laptops, and Precision workstations.',
      metaKeywords: 'dell, ultrasharp, xps, precision, monitors, workstations',
      canonicalUrl: '/brands/dell-technologies',
    },
  },
  {
    id: 'brand-3',
    name: 'Apple',
    slug: 'apple',
    logo: '/phone.jpeg',
    productsCount: 35,
    status: 'Active',
    description: 'Premium consumer electronics and professional silicon devices.',
    websiteUrl: 'https://www.apple.com',
    salesTotal: 3200000,
    salesGrowth: 18.9,
    customersCount: 890,
    featured: true,
    seo: {
      metaTitle: 'Apple iPhone, MacBook & iPad — Official Reseller',
      metaDescription: 'Buy the latest iPhone, MacBook, iPad, and Apple accessories with warranty and M-Pesa checkout.',
      metaKeywords: 'apple, iphone, macbook, ipad, airpods, apple watch',
      canonicalUrl: '/brands/apple',
    },
  },
  {
    id: 'brand-4',
    name: 'Samsung',
    slug: 'samsung',
    logo: '/phone.jpeg',
    productsCount: 127,
    status: 'Active',
    description: 'Global leader in mobile displays, memory hardware, and home appliances.',
    websiteUrl: 'https://www.samsung.com',
    salesTotal: 4800000,
    salesGrowth: 22.1,
    customersCount: 1240,
    featured: true,
    seo: {
      metaTitle: 'Samsung Galaxy Phones, TVs & Appliances',
      metaDescription: 'Shop Samsung Galaxy smartphones, QLED TVs, and home appliances at the best prices in Kenya.',
      metaKeywords: 'samsung, galaxy, qled, tv, refrigerator, smartphone',
      canonicalUrl: '/brands/samsung',
    },
  },
  {
    id: 'brand-5',
    name: 'Logitech',
    slug: 'logitech',
    logo: '/phone.jpeg',
    productsCount: 14,
    status: 'Active',
    description: 'Peripherals for productivity, gaming, and collaboration.',
    websiteUrl: 'https://www.logitech.com',
    salesTotal: 420000,
    salesGrowth: -3.2,
    customersCount: 156,
    featured: false,
    seo: {
      metaTitle: 'Logitech Keyboards, Mice & Webcams',
      metaDescription: 'Discover Logitech MX, G-series gaming, and productivity peripherals.',
      metaKeywords: 'logitech, mx master, g-series, keyboard, mouse, webcam',
      canonicalUrl: '/brands/logitech',
    },
  },
  {
    id: 'brand-6',
    name: 'Legacy Hardware Co.',
    slug: 'legacy-hardware',
    logo: '/Lenovo.jpeg',
    productsCount: 3,
    status: 'Inactive',
    description: 'Archived legacy accessories and deprecated component lines.',
    websiteUrl: 'https://legacy-hardware-example.com',
    salesTotal: 45000,
    salesGrowth: -18.4,
    customersCount: 12,
    featured: false,
    seo: DEFAULT_SEO,
  },
];

const formatKES = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n);

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>(INITIAL_BRANDS);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'products' | 'sales'>('sales');

  const [openKebabId, setOpenKebabId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [deleteBrandId, setDeleteBrandId] = useState<string | null>(null);
  const [detailBrand, setDetailBrand] = useState<Brand | null>(null);
  const [seoDrawer, setSeoDrawer] = useState<Brand | null>(null);

  // Close kebab on outside click
  useEffect(() => {
    const onDoc = () => setOpenKebabId(null);
    if (openKebabId) document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [openKebabId]);

  const handleSave = (data: Omit<Brand, 'id' | 'productsCount'> & { id?: string }) => {
    if (data.id) {
      setBrands((prev) =>
        prev.map((b) => (b.id === data.id ? ({ ...b, ...data, id: data.id } as Brand) : b))
      );
    } else {
      const newBrand: Brand = {
        id: `brand-${Date.now()}`,
        ...data,
        productsCount: 0,
        seo: data.seo || DEFAULT_SEO,
        salesTotal: data.salesTotal ?? 0,
        salesGrowth: data.salesGrowth ?? 0,
        customersCount: data.customersCount ?? 0,
        featured: data.featured ?? false,
      } as Brand;
      setBrands((prev) => [newBrand, ...prev]);
    }
  };

  const confirmDelete = () => {
    if (!deleteBrandId) return;
    setBrands((prev) => prev.filter((b) => b.id !== deleteBrandId));
    setDeleteBrandId(null);
  };

  const toggleStatus = (id: string) => {
    setBrands((prev) =>
      prev.map((b) =>
        b.id === id ? ({ ...b, status: b.status === 'Active' ? 'Inactive' : 'Active' } as Brand) : b
      )
    );
  };

  const toggleFeatured = (id: string) => {
    setBrands((prev) => prev.map((b) => (b.id === id ? { ...b, featured: !b.featured } : b)));
  };

  const updateSeo = (id: string, seo: SEOMetadata) => {
    setBrands((prev) => prev.map((b) => (b.id === id ? { ...b, seo } : b)));
    if (seoDrawer && seoDrawer.id === id) {
      setSeoDrawer({ ...seoDrawer, seo });
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return brands
      .filter((b) => {
        return (
          !q ||
          b.name.toLowerCase().includes(q) ||
          b.slug.toLowerCase().includes(q) ||
          (b.description ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'products') return b.productsCount - a.productsCount;
        return b.salesTotal - a.salesTotal;
      });
  }, [brands, searchQuery, sortBy]);

  // Summary metrics
  const totalSales = brands.reduce((a, b) => a + b.salesTotal, 0);
  const totalProducts = brands.reduce((a, b) => a + b.productsCount, 0);
  const totalCustomers = brands.reduce((a, b) => a + b.customersCount, 0);
  const activeBrands = brands.filter((b) => b.status === 'Active').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Brands</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Manage manufacturer partnerships · {brands.length} brands
            </p>
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

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Total Brands', value: brands.length.toString(), icon: Building2, color: 'text-blue-950 bg-blue-50' },
            { label: 'Active Brands', value: activeBrands.toString(), icon: Eye, color: 'text-emerald-700 bg-emerald-50' },
            { label: 'Total Products', value: totalProducts.toLocaleString(), icon: Package, color: 'text-indigo-700 bg-indigo-50' },
            { label: 'Total Sales', value: formatKES(totalSales), icon: DollarSign, color: 'text-amber-700 bg-amber-50' },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-sm p-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className={`w-6 h-6 rounded-sm flex items-center justify-center ${s.color}`}>
                  <s.icon className="w-3.5 h-3.5" />
                </span>
                <span className="text-[13px] font-medium text-slate-500 truncate">{s.label}</span>
              </div>
              <div className="text-[15px] font-bold text-slate-900 truncate">{s.value}</div>
            </div>
          ))}
        </div>

        {/* TOOLBAR */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search brands by name, slug, or description…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium text-slate-500 hidden sm:inline">Sort:</span>
            {(['sales', 'products', 'name'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                className={`px-2.5 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${sortBy === opt
                    ? 'bg-blue-50 border border-blue-950 text-blue-950'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
              >
                {opt === 'sales' ? 'Sales' : opt === 'products' ? 'Products' : 'Name'}
              </button>
            ))}

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((brand) => {
              const isKebabOpen = openKebabId === brand.id;
              const seoFilled = !!(brand.seo.metaTitle && brand.seo.metaDescription);

              return (
                <div
                  key={brand.id}
                  className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col gap-2 relative"
                >
                  {/* Top row: logo + kebab */}
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => setDetailBrand(brand)}
                      className="w-14 h-14 rounded-sm bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center hover:border-blue-950 transition"
                    >
                      <img src={brand.logo} alt={brand.name} className="w-full h-full object-cover" />
                    </button>

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
                          onEditSeo={() => {
                            setOpenKebabOpenSafe(setOpenKebabId, null);
                            setSeoDrawer(brand);
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
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setDetailBrand(brand)}
                        className="text-[13px] font-medium text-slate-900 truncate hover:text-blue-950 text-left"
                      >
                        {brand.name}
                      </button>
                      {brand.featured && (
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[13px] text-slate-500 line-clamp-2 leading-relaxed min-h-[32px]">
                      {brand.description || 'No description.'}
                    </p>
                  </div>

                  {/* Metrics row — the "Samsung → 127 products → KES 4.8M sales" pattern */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-[13px] text-slate-400">Products</span>
                      <span className="text-[13px] font-semibold text-slate-900 inline-flex items-center gap-1">
                        <Package className="w-3 h-3 text-slate-400" />
                        {brand.productsCount}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] text-slate-400">Sales</span>
                      <span className="text-[13px] font-semibold text-slate-900 inline-flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-slate-400" />
                        {formatKES(brand.salesTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Footer: growth + status + actions */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span
                      className={`inline-flex items-center gap-0.5 text-[13px] font-medium px-2 py-0.5 rounded-sm ${brand.salesGrowth >= 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-600'
                        }`}
                    >
                      {brand.salesGrowth >= 0 ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      {brand.salesGrowth >= 0 ? '+' : ''}
                      {brand.salesGrowth}%
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSeoDrawer(brand)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium text-[13px] border transition ${seoFilled
                            ? 'bg-blue-50 text-blue-950 border-blue-100 hover:bg-blue-100'
                            : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100'
                          }`}
                        title={seoFilled ? 'SEO complete' : 'SEO missing'}
                      >
                        <Globe className="w-3 h-3" />
                        {seoFilled ? 'Ready' : 'Missing'}
                      </button>
                      <button
                        onClick={() => toggleStatus(brand.id)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium text-[13px] border transition ${brand.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                      >
                        {brand.status === 'Active' ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {brand.status}
                      </button>
                    </div>
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
                    <th className="py-2 px-3 font-medium text-right">Sales</th>
                    <th className="py-2 px-3 font-medium text-right">Growth</th>
                    <th className="py-2 px-3 font-medium text-center">SEO</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((brand) => {
                    const isKebabOpen = openKebabId === brand.id;
                    const seoFilled = !!(brand.seo.metaTitle && brand.seo.metaDescription);

                    return (
                      <tr key={brand.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3">
                          <button
                            onClick={() => setDetailBrand(brand)}
                            className="flex items-center gap-2 text-left"
                          >
                            <img
                              src={brand.logo}
                              alt={brand.name}
                              className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-slate-900 block truncate">{brand.name}</span>
                                {brand.featured && (
                                  <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                                )}
                              </div>
                              <span className="text-[13px] text-slate-400 truncate block max-w-xs">
                                {brand.description}
                              </span>
                            </div>
                          </button>
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
                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                          {formatKES(brand.salesTotal)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span
                            className={`inline-flex items-center gap-0.5 text-[13px] font-medium ${brand.salesGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'
                              }`}
                          >
                            {brand.salesGrowth >= 0 ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3" />
                            )}
                            {brand.salesGrowth >= 0 ? '+' : ''}
                            {brand.salesGrowth}%
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => setSeoDrawer(brand)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium text-[13px] border transition ${seoFilled
                                ? 'bg-blue-50 text-blue-950 border-blue-100 hover:bg-blue-100'
                                : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100'
                              }`}
                          >
                            <Globe className="w-3 h-3" />
                            {seoFilled ? 'Ready' : 'Missing'}
                          </button>
                        </td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => toggleStatus(brand.id)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border transition ${brand.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                              }`}
                          >
                            {brand.status === 'Active' ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            {brand.status}
                          </button>
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
                              onEditSeo={() => {
                                setOpenKebabId(null);
                                setSeoDrawer(brand);
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

      {/* BRAND DETAIL DRAWER */}
      {detailBrand && (
        <BrandDetailDrawer
          brand={detailBrand}
          onClose={() => setDetailBrand(null)}
          onOpenSeo={() => {
            setSeoDrawer(detailBrand);
            setDetailBrand(null);
          }}
          onToggleFeatured={() => {
            toggleFeatured(detailBrand.id);
            setDetailBrand({ ...detailBrand, featured: !detailBrand.featured });
          }}
        />
      )}

      {/* SEO DRAWER */}
      {seoDrawer && (
        <SEODrawer
          brand={seoDrawer}
          onClose={() => setSeoDrawer(null)}
          onSave={(seo) => {
            updateSeo(seoDrawer.id, seo);
            setSeoDrawer(null);
          }}
        />
      )}

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
              Products associated with this brand will remain but lose their brand assignment. This cannot be undone.
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

/* Helper to safely close kebab */
function setOpenKebabOpenSafe(setter: (v: string | null) => void, value: string | null) {
  setter(value);
}

/* ─────────────────────────── Brand Detail Drawer ─────────────────────────── */
function BrandDetailDrawer({
  brand,
  onClose,
  onOpenSeo,
  onToggleFeatured,
}: {
  brand: Brand;
  onClose: () => void;
  onOpenSeo: () => void;
  onToggleFeatured: () => void;
}) {
  const seoFilled = !!(brand.seo.metaTitle && brand.seo.metaDescription);

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
            <img
              src={brand.logo}
              alt={brand.name}
              className="w-10 h-10 rounded-sm object-cover border border-slate-200 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-[13px] font-semibold text-slate-900 truncate">{brand.name}</h3>
                {brand.featured && (
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                )}
              </div>
              <p className="text-[13px] text-slate-500 truncate font-mono">/{brand.slug}</p>
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
          {/* The Samsung → 127 products → KES 4.8M sales drill-down */}
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Products" value={brand.productsCount.toLocaleString()} icon={<Package className="w-3 h-3 text-slate-400" />} />
            <Stat label="Sales" value={formatKES(brand.salesTotal)} icon={<DollarSign className="w-3 h-3 text-slate-400" />} />
            <Stat label="Customers" value={brand.customersCount.toLocaleString()} icon={<Users className="w-3 h-3 text-slate-400" />} />
          </div>

          {/* Growth panel */}
          <div
            className={`rounded-sm p-2 flex items-center justify-between gap-2 ${brand.salesGrowth >= 0
                ? 'bg-emerald-50 border border-emerald-100'
                : 'bg-red-50 border border-red-100'
              }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-8 h-8 rounded-sm flex items-center justify-center ${brand.salesGrowth >= 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-600'
                  }`}
              >
                <TrendingUp className="w-4 h-4" />
              </span>
              <div>
                <p
                  className={`text-[13px] font-medium ${brand.salesGrowth >= 0 ? 'text-emerald-800' : 'text-red-700'
                    }`}
                >
                  Sales growth
                </p>
                <p className="text-[13px] text-slate-500">vs previous 30 days</p>
              </div>
            </div>
            <span
              className={`text-[15px] font-bold inline-flex items-center gap-1 ${brand.salesGrowth >= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}
            >
              {brand.salesGrowth >= 0 ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              {brand.salesGrowth >= 0 ? '+' : ''}
              {brand.salesGrowth}%
            </span>
          </div>

          {/* Description */}
          {brand.description && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
                <Building2 className="w-3.5 h-3.5" />
                About
              </div>
              <p className="text-[13px] text-slate-600 leading-relaxed">{brand.description}</p>
            </div>
          )}

          {/* Website */}
          {brand.websiteUrl && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
                <Globe className="w-3.5 h-3.5" />
                Website
              </div>
              <a
                href={brand.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] text-blue-950 hover:underline inline-flex items-center gap-1"
              >
                {brand.websiteUrl}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={onOpenSeo}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium border transition ${seoFilled
                  ? 'bg-blue-50 border-blue-100 text-blue-950 hover:bg-blue-100'
                  : 'bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100'
                }`}
            >
              <Globe className="w-3.5 h-3.5" />
              {seoFilled ? 'Edit SEO' : 'Add SEO'}
            </button>
            <button
              onClick={onToggleFeatured}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium border transition ${brand.featured
                  ? 'bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
            >
              <Star className={`w-3.5 h-3.5 ${brand.featured ? 'fill-amber-700' : ''}`} />
              {brand.featured ? 'Featured' : 'Mark featured'}
            </button>
          </div>

          {/* SEO snapshot */}
          <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-1">
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
              <Globe className="w-3.5 h-3.5" />
              SEO snapshot
            </div>
            {seoFilled ? (
              <div className="space-y-1">
                <div className="text-[13px] text-slate-800 font-medium truncate">{brand.seo.metaTitle}</div>
                <div className="text-[13px] text-slate-500 line-clamp-2">{brand.seo.metaDescription}</div>
                <div className="text-[13px] text-emerald-700 font-mono truncate">
                  {brand.seo.canonicalUrl}
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-amber-700">
                No SEO metadata yet. Click "Add SEO" to fill it in.
              </p>
            )}
          </div>

          {/* Performance bar */}
          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
              <BarChart3 className="w-3.5 h-3.5" />
              Brand performance
            </div>
            <div className="space-y-2">
              <MetricBar label="Products" value={brand.productsCount} max={150} color="#172554" />
              <MetricBar
                label="Customers"
                value={brand.customersCount}
                max={1500}
                color="#10b981"
              />
              <MetricBar
                label="Sales (KES)"
                value={brand.salesTotal / 1000}
                max={5000}
                color="#f59e0b"
                suffix="K"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── SEO Drawer ─────────────────────────── */
function SEODrawer({
  brand,
  onClose,
  onSave,
}: {
  brand: Brand;
  onClose: () => void;
  onSave: (seo: SEOMetadata) => void;
}) {
  const [seo, setSeo] = useState<SEOMetadata>(brand.seo || DEFAULT_SEO);

  const titleLength = seo.metaTitle.length;
  const descLength = seo.metaDescription.length;
  const titleOk = titleLength >= 30 && titleLength <= 60;
  const descOk = descLength >= 120 && descLength <= 160;

  const titlePreview = seo.metaTitle || `${brand.name} — Products & Reviews`;
  const descPreview =
    seo.metaDescription ||
    `Shop ${brand.name} products at the best prices in Kenya. Fast delivery and M-Pesa checkout.`;

  return (
    <div
      className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex justify-end"
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
              <p className="text-[13px] text-slate-500 truncate">{brand.name}</p>
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
              placeholder={`${brand.name} — Products & Reviews`}
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
            <p className="text-[13px] text-slate-400 mt-1">
              Recommended: 30–60 characters. Shown as the clickable headline in search results.
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
              placeholder={`Shop ${brand.name} products at the best prices in Kenya.`}
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
          </div>

          {/* Canonical URL */}
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1">Canonical URL</label>
            <input
              type="text"
              value={seo.canonicalUrl}
              onChange={(e) => setSeo({ ...seo, canonicalUrl: e.target.value })}
              placeholder={`/brands/${brand.slug}`}
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>

          {/* Search preview */}
          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-1">
            <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
              <Search className="w-3 h-3" />
              Search preview
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-sm p-2">
              <div className="text-[13px] text-emerald-700 truncate">
                yourstore.co.ke{seo.canonicalUrl || `/brands/${brand.slug}`}
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

/* ─────────────────────────── Stat ─────────────────────────── */
function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-sm p-2">
      <div className="flex items-center gap-1 text-[13px] font-medium text-slate-500">
        {icon}
        {label}
      </div>
      <p className="text-[13px] font-semibold text-slate-900 mt-0.5 truncate">{value}</p>
    </div>
  );
}

/* ─────────────────────────── Metric bar ─────────────────────────── */
function MetricBar({
  label,
  value,
  max,
  color,
  suffix = '',
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-slate-600">{label}</span>
        <span className="font-mono text-slate-800">
          {value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          {suffix}
        </span>
      </div>
      <div className="w-full bg-slate-100 h-1.5 rounded-sm overflow-hidden">
        <div className="h-full rounded-sm" style={{ width: `${pct}%`, backgroundColor: color }} />
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
        Edit brand
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