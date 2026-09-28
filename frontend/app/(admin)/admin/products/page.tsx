'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Copy,
  ExternalLink,
  Trash2,
  ChevronDown,
  ChevronRight,
  X,
  AlertTriangle,
  Check,
  LayoutGrid,
  List as ListIcon,
  ArrowUpDown,
  Package,
  Tag,
  Layers,
  Palette,
  Ruler,
  DollarSign,
  Warehouse,
  Percent,
  FileText,
  Image as ImageIcon,
  Video,
  Star,
  Box,
} from 'lucide-react';
import AddProductModal from '@/components/admin/AddProductModal';

// --- TYPES ---
type ProductStatus = 'Published' | 'Draft' | 'Archived';
type ViewMode = 'table' | 'cards';
type InventoryStatus = 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Backorder';

interface ProductVariant {
  id: string;
  options: { name: string; value: string }[];
  sku: string;
  price: number;
  stock: number;
  image?: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  shortDescription: string;
  category: string;
  brand: string;
  tags: string[];
  price: number;
  salePrice?: number;
  costPrice?: number;
  tax: number;
  discount: number;
  stock: number;
  lowStockThreshold: number;
  inventoryStatus: InventoryStatus;
  status: ProductStatus;
  image: string;
  video?: string;
  featured: boolean;
  variants: ProductVariant[];
  variantOptions: { name: string; values: string[] }[];
}

const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Apex Ultra X1 Pro Smartphone 5G',
    sku: 'APX-X1-5G',
    description: 'Flagship 5G smartphone with 6.7" AMOLED display, 108MP camera, and 5,000mAh battery.',
    shortDescription: 'Flagship 5G smartphone',
    category: 'Smartphones',
    brand: 'Apex',
    tags: ['5G', 'Flagship', 'AMOLED'],
    price: 89999,
    salePrice: 84999,
    costPrice: 68000,
    tax: 16,
    discount: 5,
    stock: 14,
    lowStockThreshold: 10,
    inventoryStatus: 'In Stock',
    status: 'Published',
    image: '/phone.jpeg',
    featured: true,
    variantOptions: [
      { name: 'Color', values: ['Black', 'White', 'Blue'] },
      { name: 'Storage', values: ['128GB', '256GB', '512GB'] },
    ],
    variants: [
      { id: 'v1', options: [{ name: 'Color', value: 'Black' }, { name: 'Storage', value: '128GB' }], sku: 'APX-X1-5G-BLK-128', price: 89999, stock: 4 },
      { id: 'v2', options: [{ name: 'Color', value: 'Black' }, { name: 'Storage', value: '256GB' }], sku: 'APX-X1-5G-BLK-256', price: 99999, stock: 3 },
      { id: 'v3', options: [{ name: 'Color', value: 'Black' }, { name: 'Storage', value: '512GB' }], sku: 'APX-X1-5G-BLK-512', price: 119999, stock: 2 },
      { id: 'v4', options: [{ name: 'Color', value: 'White' }, { name: 'Storage', value: '128GB' }], sku: 'APX-X1-5G-WHT-128', price: 89999, stock: 2 },
      { id: 'v5', options: [{ name: 'Color', value: 'White' }, { name: 'Storage', value: '256GB' }], sku: 'APX-X1-5G-WHT-256', price: 99999, stock: 1 },
      { id: 'v6', options: [{ name: 'Color', value: 'White' }, { name: 'Storage', value: '512GB' }], sku: 'APX-X1-5G-WHT-512', price: 119999, stock: 1 },
      { id: 'v7', options: [{ name: 'Color', value: 'Blue' }, { name: 'Storage', value: '128GB' }], sku: 'APX-X1-5G-BLU-128', price: 89999, stock: 1 },
      { id: 'v8', options: [{ name: 'Color', value: 'Blue' }, { name: 'Storage', value: '256GB' }], sku: 'APX-X1-5G-BLU-256', price: 99999, stock: 0 },
    ],
  },
  {
    id: 'p2',
    name: 'Zenith StudioBook Pro 16 Laptop',
    sku: 'ZNT-SB16-L',
    description: '16-inch creator laptop with M3 Max chip, 32GB RAM, 1TB SSD.',
    shortDescription: 'Creator-grade 16" laptop',
    category: 'Laptops',
    brand: 'Zenith',
    tags: ['Creator', 'M3 Max', '16-inch'],
    price: 149999,
    costPrice: 118000,
    tax: 16,
    discount: 0,
    stock: 3,
    lowStockThreshold: 5,
    inventoryStatus: 'Low Stock',
    status: 'Published',
    image: '/Lenovo.jpeg',
    featured: true,
    variantOptions: [
      { name: 'RAM', values: ['16GB', '32GB', '64GB'] },
      { name: 'Storage', values: ['512GB', '1TB', '2TB'] },
    ],
    variants: [
      { id: 'v1', options: [{ name: 'RAM', value: '16GB' }, { name: 'Storage', value: '512GB' }], sku: 'ZNT-SB16-16-512', price: 129999, stock: 1 },
      { id: 'v2', options: [{ name: 'RAM', value: '16GB' }, { name: 'Storage', value: '1TB' }], sku: 'ZNT-SB16-16-1T', price: 139999, stock: 1 },
      { id: 'v3', options: [{ name: 'RAM', value: '32GB' }, { name: 'Storage', value: '1TB' }], sku: 'ZNT-SB16-32-1T', price: 149999, stock: 1 },
      { id: 'v4', options: [{ name: 'RAM', value: '32GB' }, { name: 'Storage', value: '2TB' }], sku: 'ZNT-SB16-32-2T', price: 169999, stock: 0 },
      { id: 'v5', options: [{ name: 'RAM', value: '64GB' }, { name: 'Storage', value: '2TB' }], sku: 'ZNT-SB16-64-2T', price: 199999, stock: 0 },
    ],
  },
  {
    id: 'p3',
    name: 'Dell UltraSharp 27" 4K Hub Monitor',
    sku: 'DLL-U27-4K',
    description: '27-inch 4K IPS monitor with USB-C hub, 99% sRGB.',
    shortDescription: '27" 4K USB-C monitor',
    category: 'Displays',
    brand: 'Dell',
    tags: ['4K', 'USB-C', 'IPS'],
    price: 45000,
    salePrice: 42000,
    costPrice: 34000,
    tax: 16,
    discount: 7,
    stock: 5,
    lowStockThreshold: 5,
    inventoryStatus: 'Low Stock',
    status: 'Published',
    image: '/dellmonitor.jpeg',
    featured: false,
    variantOptions: [],
    variants: [],
  },
  {
    id: 'p4',
    name: 'Wireless Mechanical Keyboard K2',
    sku: 'MCH-K2-WL',
    description: '75% wireless mechanical keyboard with hot-swappable switches.',
    shortDescription: '75% wireless mechanical keyboard',
    category: 'Accessories',
    brand: 'Keychron',
    tags: ['Mechanical', 'Wireless', '75%'],
    price: 12999,
    costPrice: 8500,
    tax: 16,
    discount: 0,
    stock: 24,
    lowStockThreshold: 10,
    inventoryStatus: 'In Stock',
    status: 'Published',
    image: '/phone.jpeg',
    featured: false,
    variantOptions: [
      { name: 'Switch', values: ['Brown', 'Red', 'Blue'] },
      { name: 'Layout', values: ['US', 'UK', 'DE'] },
    ],
    variants: [
      { id: 'v1', options: [{ name: 'Switch', value: 'Brown' }, { name: 'Layout', value: 'US' }], sku: 'MCH-K2-WL-BR-US', price: 12999, stock: 8 },
      { id: 'v2', options: [{ name: 'Switch', value: 'Brown' }, { name: 'Layout', value: 'UK' }], sku: 'MCH-K2-WL-BR-UK', price: 12999, stock: 3 },
      { id: 'v3', options: [{ name: 'Switch', value: 'Red' }, { name: 'Layout', value: 'US' }], sku: 'MCH-K2-WL-RD-US', price: 12999, stock: 6 },
      { id: 'v4', options: [{ name: 'Switch', value: 'Blue' }, { name: 'Layout', value: 'US' }], sku: 'MCH-K2-WL-BL-US', price: 13999, stock: 4 },
      { id: 'v5', options: [{ name: 'Switch', value: 'Red' }, { name: 'Layout', value: 'DE' }], sku: 'MCH-K2-WL-RD-DE', price: 12999, stock: 3 },
    ],
  },
  {
    id: 'p5',
    name: 'Ergonomic Office Chair Executive',
    sku: 'ERG-CHR-01',
    description: 'Premium ergonomic office chair with lumbar support and headrest.',
    shortDescription: 'Premium ergonomic office chair',
    category: 'Furniture',
    brand: 'ErgoFlex',
    tags: ['Ergonomic', 'Executive', 'Lumbar'],
    price: 34999,
    costPrice: 26000,
    tax: 16,
    discount: 0,
    stock: 0,
    lowStockThreshold: 3,
    inventoryStatus: 'Out of Stock',
    status: 'Draft',
    image: '/Lenovo.jpeg',
    featured: false,
    variantOptions: [
      { name: 'Color', values: ['Black', 'Grey'] },
    ],
    variants: [
      { id: 'v1', options: [{ name: 'Color', value: 'Black' }], sku: 'ERG-CHR-01-BLK', price: 34999, stock: 0 },
      { id: 'v2', options: [{ name: 'Color', value: 'Grey' }], sku: 'ERG-CHR-01-GRY', price: 34999, stock: 0 },
    ],
  },
  {
    id: 'p6',
    name: 'Logitech MX Master 3S Wireless Mouse',
    sku: 'LOG-MX3S-M',
    description: 'Advanced wireless mouse with 8K DPI and quiet clicks.',
    shortDescription: 'Advanced wireless mouse',
    category: 'Accessories',
    brand: 'Logitech',
    tags: ['Wireless', '8K DPI', 'Quiet'],
    price: 14500,
    costPrice: 10500,
    tax: 16,
    discount: 0,
    stock: 8,
    lowStockThreshold: 5,
    inventoryStatus: 'Low Stock',
    status: 'Published',
    image: '/phone.jpeg',
    featured: false,
    variantOptions: [],
    variants: [],
  },
  {
    id: 'p7',
    name: 'Sony WH-1000XM5 Noise Cancelling',
    sku: 'SNY-WH5-BLK',
    description: 'Industry-leading noise cancelling headphones with 30-hour battery.',
    shortDescription: 'Premium noise cancelling headphones',
    category: 'Audio',
    brand: 'Sony',
    tags: ['Noise Cancelling', '30h Battery', 'Premium'],
    price: 42000,
    salePrice: 38999,
    costPrice: 31000,
    tax: 16,
    discount: 7,
    stock: 1,
    lowStockThreshold: 5,
    inventoryStatus: 'Low Stock',
    status: 'Published',
    image: '/phone.jpeg',
    featured: true,
    variantOptions: [
      { name: 'Color', values: ['Black', 'Silver'] },
    ],
    variants: [
      { id: 'v1', options: [{ name: 'Color', value: 'Black' }], sku: 'SNY-WH5-BLK', price: 42000, stock: 1 },
      { id: 'v2', options: [{ name: 'Color', value: 'Silver' }], sku: 'SNY-WH5-SLV', price: 42000, stock: 0 },
    ],
  },
  {
    id: 'p8',
    name: 'Anker Prime 24,000mAh Power Bank',
    sku: 'ANK-P24K-PB',
    description: '24,000mAh power bank with 140W output and smart display.',
    shortDescription: 'High-capacity power bank',
    category: 'Accessories',
    brand: 'Anker',
    tags: ['Power Bank', '140W', 'Smart Display'],
    price: 18500,
    costPrice: 13500,
    tax: 16,
    discount: 0,
    stock: 35,
    lowStockThreshold: 10,
    inventoryStatus: 'In Stock',
    status: 'Archived',
    image: '/phone.jpeg',
    featured: false,
    variantOptions: [],
    variants: [],
  },
];

const CATEGORIES = ['Smartphones', 'Laptops', 'Displays', 'Accessories', 'Furniture', 'Audio'];
const BRANDS = ['Apex', 'Zenith', 'Dell', 'Keychron', 'ErgoFlex', 'Logitech', 'Sony', 'Anker'];
const STATUSES: ProductStatus[] = ['Published', 'Draft', 'Archived'];
const INVENTORY_STATUSES: InventoryStatus[] = ['In Stock', 'Low Stock', 'Out of Stock', 'Backorder'];

const formatKES = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n);

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ProductStatus | null>(null);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('featured');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openKebabId, setOpenKebabId] = useState<string | null>(null);

  // Modals
  const [addOpen, setAddOpen] = useState(false);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [duplicateProduct, setDuplicateProduct] = useState<Product | null>(null);
  const [variantsProduct, setVariantsProduct] = useState<Product | null>(null);

  const anyModalOpen =
    addOpen || deleteProductId !== null || editProduct !== null || viewProduct !== null ||
    duplicateProduct !== null || variantsProduct !== null;

  // Close kebab when clicking elsewhere
  useEffect(() => {
    const onDoc = () => setOpenKebabId(null);
    if (openKebabId) document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [openKebabId]);

  // Filter + sort
  const filtered = products
    .filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const matchesCat = !selectedCategory || p.category === selectedCategory;
      const matchesBrand = !selectedBrand || p.brand === selectedBrand;
      const matchesStatus = !selectedStatus || p.status === selectedStatus;
      let matchesStock = true;
      if (selectedStock === 'In stock') matchesStock = p.stock > 10;
      else if (selectedStock === 'Low') matchesStock = p.stock >= 1 && p.stock <= 10;
      else if (selectedStock === 'Out') matchesStock = p.stock === 0;
      return matchesSearch && matchesCat && matchesBrand && matchesStatus && matchesStock;
    })
    .sort((a, b) => {
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'stock') return b.stock - a.stock;
      return 0;
    });

  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length;
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : filtered.map((p) => p.id));
  const toggleRow = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const confirmDelete = () => {
    if (!deleteProductId) return;
    setProducts((prev) => prev.filter((p) => p.id !== deleteProductId));
    setDeleteProductId(null);
  };

  const confirmBulkDelete = () => {
    setProducts((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
    setSelectedIds([]);
  };

  const confirmDuplicate = () => {
    if (!duplicateProduct) return;
    const dup: Product = {
      ...duplicateProduct,
      id: `p-${Date.now()}`,
      name: `${duplicateProduct.name} (Copy)`,
      sku: `${duplicateProduct.sku}-DUP`,
      status: 'Draft',
      variants: duplicateProduct.variants.map((v, i) => ({
        ...v,
        id: `v-${Date.now()}-${i}`,
        sku: `${v.sku}-DUP`,
      })),
    };
    setProducts((prev) => [dup, ...prev]);
    setDuplicateProduct(null);
  };

  const activeFilterCount =
    (selectedCategory ? 1 : 0) +
    (selectedBrand ? 1 : 0) +
    (selectedStatus ? 1 : 0) +
    (selectedStock ? 1 : 0);

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedBrand(null);
    setSelectedStatus(null);
    setSelectedStock(null);
    setSortBy('featured');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {/* PAGE HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Products</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Manage your product catalog · {products.length} products</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex bg-slate-100 p-0.5 rounded-sm border border-slate-200">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-sm transition ${viewMode === 'table' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                title="Table view"
              >
                <ListIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-sm transition ${viewMode === 'cards' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                title="Card view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add product</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* FILTER BAR */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search products by name or SKU…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              label="Category"
              value={selectedCategory}
              options={CATEGORIES}
              onChange={setSelectedCategory}
            />
            <FilterDropdown
              label="Brand"
              value={selectedBrand}
              options={BRANDS}
              onChange={setSelectedBrand}
            />
            <FilterDropdown
              label="Status"
              value={selectedStatus}
              options={STATUSES as unknown as string[]}
              onChange={(v) => setSelectedStatus(v as ProductStatus | null)}
            />
            <FilterDropdown
              label="Stock"
              value={selectedStock}
              options={['In stock', 'Low', 'Out']}
              onChange={setSelectedStock}
            />
            <FilterDropdown
              label="Sort"
              icon={<ArrowUpDown className="w-3.5 h-3.5" />}
              value={sortBy === 'featured' ? null : sortBy}
              options={['price-low', 'price-high', 'name', 'stock']}
              labels={{
                'price-low': 'Price: Low to High',
                'price-high': 'Price: High to Low',
                'name': 'Name A–Z',
                'stock': 'Most stock',
              }}
              onChange={(v) => setSortBy(v ?? 'featured')}
              align="end"
            />
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-[13px] text-red-600 hover:underline font-medium px-2 py-2"
              >
                Clear ({activeFilterCount})
              </button>
            )}
          </div>
        </div>

        {/* BULK ACTIONS */}
        {selectedIds.length > 0 && (
          <div className="bg-blue-950 text-white rounded-sm px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[13px]">
              <span className="bg-blue-900 font-medium px-2 py-0.5 rounded-sm">{selectedIds.length} selected</span>
              <span className="text-blue-200 hidden sm:inline">Bulk actions</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => alert('Change status for selected')}
                className="bg-blue-900 hover:bg-blue-800 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Change status
              </button>
              <button
                onClick={() => alert('Update prices for selected')}
                className="bg-blue-900 hover:bg-blue-800 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Update price
              </button>
              <button
                onClick={() => alert('Export selected as CSV')}
                className="bg-blue-900 hover:bg-blue-800 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Export CSV
              </button>
              <button
                onClick={confirmBulkDelete}
                className="bg-red-600 hover:bg-red-500 px-2.5 py-2 rounded-sm text-[13px] font-medium transition inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        )}

        {/* TABLE / CARDS */}
        {viewMode === 'table' ? (
          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                      />
                    </th>
                    <th className="py-2 px-2 font-medium">Image</th>
                    <th className="py-2 px-3 font-medium">Product</th>
                    <th className="py-2 px-3 font-medium">SKU</th>
                    <th className="py-2 px-3 font-medium">Category</th>
                    <th className="py-2 px-3 font-medium text-right">Price</th>
                    <th className="py-2 px-3 font-medium text-center">Stock</th>
                    <th className="py-2 px-3 font-medium text-center">Variants</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 text-[13px]">
                        No products match your filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => {
                      const stockBadge =
                        p.stock === 0
                          ? 'bg-red-50 text-red-600 border-red-200'
                          : p.stock <= p.lowStockThreshold
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      const statusBadge =
                        p.status === 'Published'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : p.status === 'Draft'
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-amber-50 text-amber-700 border-amber-100';
                      const isKebabOpen = openKebabId === p.id;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(p.id)}
                              onChange={() => toggleRow(p.id)}
                              className="rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <img
                              src={p.image}
                              alt={p.name}
                              className="w-9 h-9 rounded-sm object-cover border border-slate-200"
                            />
                          </td>
                          <td className="py-2 px-3 max-w-[280px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-slate-900 truncate">{p.name}</span>
                              {p.featured && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                            </div>
                            {p.tags.length > 0 && (
                              <div className="flex items-center gap-1 mt-0.5">
                                {p.tags.slice(0, 2).map((t) => (
                                  <span key={t} className="text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-sm">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-500 font-mono">{p.sku}</td>
                          <td className="py-2 px-3 text-slate-600">{p.category}</td>
                          <td className="py-2 px-3 text-right">
                            <div className="font-semibold text-slate-900">{formatKES(p.salePrice ?? p.price)}</div>
                            {p.salePrice && (
                              <div className="text-[13px] text-slate-400 line-through">{formatKES(p.price)}</div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${stockBadge}`}>
                              {p.stock}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {p.variants.length > 0 ? (
                              <button
                                onClick={() => setVariantsProduct(p)}
                                className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-950 hover:underline"
                              >
                                <Layers className="w-3 h-3" />
                                {p.variants.length}
                              </button>
                            ) : (
                              <span className="text-[13px] text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${statusBadge}`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenKebabId(isKebabOpen ? null : p.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-900 rounded-sm hover:bg-slate-100 transition"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {isKebabOpen && (
                              <KebabMenu
                                onEdit={() => {
                                  setOpenKebabId(null);
                                  setEditProduct(p);
                                }}
                                onDuplicate={() => {
                                  setOpenKebabId(null);
                                  setDuplicateProduct(p);
                                }}
                                onView={() => {
                                  setOpenKebabId(null);
                                  setViewProduct(p);
                                }}
                                onDelete={() => {
                                  setOpenKebabId(null);
                                  setDeleteProductId(p.id);
                                }}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((p) => {
              const stockBadge =
                p.stock === 0
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : p.stock <= p.lowStockThreshold
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200';
              const isKebabOpen = openKebabId === p.id;

              return (
                <div
                  key={p.id}
                  className="bg-white border border-slate-200 rounded-sm p-2 space-y-2 relative"
                >
                  <div className="relative aspect-[4/3] rounded-sm overflow-hidden bg-slate-100 border border-slate-200">
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                    <span className="absolute top-2 right-2 bg-blue-950 text-white font-medium text-[13px] px-2 py-0.5 rounded-sm">
                      {p.status}
                    </span>
                    {p.featured && (
                      <span className="absolute top-2 left-2 bg-amber-500 text-white font-medium text-[13px] px-2 py-0.5 rounded-sm inline-flex items-center gap-1">
                        <Star className="w-3 h-3 fill-white" />
                        Featured
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-blue-950 uppercase tracking-wide truncate">
                        {p.category}
                      </span>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenKebabId(isKebabOpen ? null : p.id);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-900 rounded-sm hover:bg-slate-100 transition"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {isKebabOpen && (
                          <KebabMenu
                            align="right"
                            onEdit={() => {
                              setOpenKebabId(null);
                              setEditProduct(p);
                            }}
                            onDuplicate={() => {
                              setOpenKebabId(null);
                              setDuplicateProduct(p);
                            }}
                            onView={() => {
                              setOpenKebabId(null);
                              setViewProduct(p);
                            }}
                            onDelete={() => {
                              setOpenKebabId(null);
                              setDeleteProductId(p.id);
                            }}
                          />
                        )}
                      </div>
                    </div>

                    <h3 className="text-[13px] font-medium text-slate-900 line-clamp-2">{p.name}</h3>
                    <p className="text-[13px] text-slate-400 font-mono">SKU: {p.sku}</p>
                    {p.variants.length > 0 && (
                      <button
                        onClick={() => setVariantsProduct(p)}
                        className="text-[13px] text-blue-950 hover:underline inline-flex items-center gap-1"
                      >
                        <Layers className="w-3 h-3" />
                        {p.variants.length} variants
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[13px] font-bold text-slate-900">{formatKES(p.salePrice ?? p.price)}</span>
                      {p.salePrice && (
                        <span className="text-[13px] text-slate-400 line-through ml-1">{formatKES(p.price)}</span>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-sm font-medium text-[13px] border ${stockBadge}`}>
                      {p.stock} left
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ---- ADD PRODUCT MODAL ---- */}
      <AddProductModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={(data: any) => {
          const newProduct: Product = {
            id: `p-${Date.now()}`,
            name: data.name || 'Untitled',
            sku: data.sku || `SKU-${Math.floor(Math.random() * 90000)}`,
            description: data.description || '',
            shortDescription: data.shortDescription || '',
            category: data.category || 'Accessories',
            brand: data.brand || 'Generic',
            tags: data.tags || [],
            price: Number(data.price) || 0,
            salePrice: data.salePrice ? Number(data.salePrice) : undefined,
            costPrice: data.costPrice ? Number(data.costPrice) : undefined,
            tax: Number(data.tax) || 16,
            discount: Number(data.discount) || 0,
            stock: Number(data.stock) || 0,
            lowStockThreshold: Number(data.lowStockThreshold) || 10,
            inventoryStatus: data.stock === 0 ? 'Out of Stock' : 'In Stock',
            status: data.status === 'draft' ? 'Draft' : 'Published',
            image: data.images?.[0] || '/phone.jpeg',
            video: data.video || undefined,
            featured: !!data.featured,
            variantOptions: data.variantOptions || [],
            variants: data.variants || [],
          };
          setProducts((prev) => [newProduct, ...prev]);
        }}
      />

      {/* ---- DELETE CONFIRM ---- */}
      {deleteProductId && (
        <Popup onClose={() => setDeleteProductId(null)}>
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-sm bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <h3 className="text-[15px] font-semibold text-slate-900">Delete product?</h3>
          </div>
          <p className="text-[13px] text-slate-500 mt-2">
            This cannot be undone. The product and all its variants will be permanently removed.
          </p>
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setDeleteProductId(null)}
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
        </Popup>
      )}

      {/* ---- QUICK EDIT ---- */}
      {editProduct && (
        <Popup onClose={() => setEditProduct(null)}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[15px] font-semibold text-slate-900">Quick edit</h3>
            <button onClick={() => setEditProduct(null)} className="text-slate-400 hover:text-slate-900 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 text-[13px]">
            <label className="block">
              <span className="block font-medium text-slate-700 mb-1">Name</span>
              <input
                value={editProduct.name}
                onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block font-medium text-slate-700 mb-1">Price (KES)</span>
                <input
                  type="number"
                  value={editProduct.price}
                  onChange={(e) => setEditProduct({ ...editProduct, price: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </label>
              <label className="block">
                <span className="block font-medium text-slate-700 mb-1">Sale Price (KES)</span>
                <input
                  type="number"
                  value={editProduct.salePrice ?? ''}
                  onChange={(e) => setEditProduct({ ...editProduct, salePrice: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block font-medium text-slate-700 mb-1">Stock</span>
                <input
                  type="number"
                  value={editProduct.stock}
                  onChange={(e) => setEditProduct({ ...editProduct, stock: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </label>
              <label className="block">
                <span className="block font-medium text-slate-700 mb-1">Low-stock threshold</span>
                <input
                  type="number"
                  value={editProduct.lowStockThreshold}
                  onChange={(e) => setEditProduct({ ...editProduct, lowStockThreshold: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </label>
            </div>

            <label className="block">
              <span className="block font-medium text-slate-700 mb-1">Status</span>
              <select
                value={editProduct.status}
                onChange={(e) => setEditProduct({ ...editProduct, status: e.target.value as ProductStatus })}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>

            {editProduct.variants.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-sm p-2 text-[13px]">
                <div className="flex items-center gap-1.5 text-blue-950 font-medium">
                  <Layers className="w-3.5 h-3.5" />
                  {editProduct.variants.length} variants
                </div>
                <p className="text-slate-600 mt-0.5">
                  Edit variants separately from the variants drawer.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setEditProduct(null)}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setProducts((prev) => prev.map((x) => (x.id === editProduct.id ? editProduct : x)));
                setEditProduct(null);
              }}
              className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              Save
            </button>
          </div>
        </Popup>
      )}

      {/* ---- VIEW PRODUCT DRAWER ---- */}
      {viewProduct && (
        <ProductDrawer
          product={viewProduct}
          onClose={() => setViewProduct(null)}
          onOpenVariants={() => {
            setVariantsProduct(viewProduct);
            setViewProduct(null);
          }}
        />
      )}

      {/* ---- VARIANTS DRAWER ---- */}
      {variantsProduct && (
        <VariantsDrawer
          product={variantsProduct}
          onClose={() => setVariantsProduct(null)}
          onUpdate={(updated) => {
            setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setVariantsProduct(updated);
          }}
        />
      )}

      {/* ---- DUPLICATE ---- */}
      {duplicateProduct && (
        <Popup onClose={() => setDuplicateProduct(null)}>
          <h3 className="text-[15px] font-semibold text-slate-900">Duplicate product?</h3>
          <p className="text-[13px] text-slate-500 mt-2">
            Create a copy of <span className="font-medium text-slate-900">{duplicateProduct.name}</span> with a new SKU.
            The copy will be saved as Draft.
          </p>
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setDuplicateProduct(null)}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              Cancel
            </button>
            <button
              onClick={confirmDuplicate}
              className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              Duplicate
            </button>
          </div>
        </Popup>
      )}

      {/* Backdrop when any modal is open */}
      {anyModalOpen && <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm" />}
    </div>
  );
}

/* ─────────────────────────── Product Drawer ─────────────────────────── */
function ProductDrawer({
  product,
  onClose,
  onOpenVariants,
}: {
  product: Product;
  onClose: () => void;
  onOpenVariants: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border-l border-slate-200 w-full max-w-2xl h-full overflow-y-auto shadow-xl flex flex-col"
      >
        {/* Header */}
        <div className="px-3 py-3 border-b border-slate-200 sticky top-0 bg-white z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-9 h-9 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold text-slate-900 truncate">Product Details</h3>
              <p className="text-[13px] text-slate-500 truncate">SKU: {product.sku}</p>
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
          {/* Hero image */}
          <div className="aspect-[16/9] rounded-sm overflow-hidden bg-slate-100 border border-slate-200">
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          </div>

          {/* Title + tags */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">{product.category}</span>
              <span className="text-slate-300">·</span>
              <span className="text-[13px] text-slate-500">{product.brand}</span>
              {product.featured && (
                <span className="text-[13px] font-medium bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-sm inline-flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-700" /> Featured
                </span>
              )}
            </div>
            <h2 className="text-[15px] font-bold text-slate-900">{product.name}</h2>
            {product.shortDescription && (
              <p className="text-[13px] text-slate-500">{product.shortDescription}</p>
            )}
          </div>

          {/* Tags */}
          {product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {product.tags.map((t) => (
                <span key={t} className="text-[13px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-sm inline-flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Pricing */}
          <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
              <DollarSign className="w-3.5 h-3.5" />
              Pricing
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[13px]">
              <Stat label="Regular" value={formatKES(product.price)} />
              <Stat label="Sale" value={product.salePrice ? formatKES(product.salePrice) : '—'} />
              <Stat label="Cost" value={product.costPrice ? formatKES(product.costPrice) : '—'} />
              <Stat label="Tax" value={`${product.tax}%`} />
              <Stat label="Discount" value={`${product.discount}%`} />
              {product.salePrice && (
                <Stat
                  label="Margin"
                  value={`${Math.round(((product.salePrice - (product.costPrice || 0)) / product.salePrice) * 100)}%`}
                />
              )}
            </div>
          </div>

          {/* Inventory */}
          <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
              <Warehouse className="w-3.5 h-3.5" />
              Inventory
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[13px]">
              <Stat label="Stock" value={`${product.stock} units`} />
              <Stat label="Low-stock threshold" value={`${product.lowStockThreshold} units`} />
              <Stat label="Inventory status" value={product.inventoryStatus} />
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
                <FileText className="w-3.5 h-3.5" />
                Description
              </div>
              <p className="text-[13px] text-slate-600 leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* Media */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
              <ImageIcon className="w-3.5 h-3.5" />
              Media
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="aspect-square rounded-sm overflow-hidden border border-slate-200 bg-slate-100">
                <img src={product.image} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="aspect-square rounded-sm border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 text-[13px]">
                <ImageIcon className="w-4 h-4" />
                <span className="mt-1">Image 2</span>
              </div>
              <div className="aspect-square rounded-sm border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 text-[13px]">
                <Video className="w-4 h-4" />
                <span className="mt-1">Video</span>
              </div>
            </div>
          </div>

          {/* Variants section */}
          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
                <Layers className="w-3.5 h-3.5" />
                Variants
              </div>
              {product.variants.length > 0 && (
                <button
                  onClick={onOpenVariants}
                  className="text-[13px] text-blue-950 hover:underline font-medium"
                >
                  Manage
                </button>
              )}
            </div>

            {product.variantOptions.length === 0 ? (
              <p className="text-[13px] text-slate-400">This product has no variants.</p>
            ) : (
              <div className="space-y-2">
                {product.variantOptions.map((opt) => (
                  <div key={opt.name} className="text-[13px]">
                    <div className="flex items-center gap-1.5 text-slate-600 mb-1">
                      {opt.name === 'Color' ? <Palette className="w-3 h-3" /> :
                        opt.name === 'Size' ? <Ruler className="w-3 h-3" /> :
                          <Box className="w-3 h-3" />}
                      <span className="font-medium">{opt.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {opt.values.map((v) => (
                        <span key={v} className="text-[13px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-sm">
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="pt-1 border-t border-slate-100">
                  <button
                    onClick={onOpenVariants}
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium py-2 rounded-sm text-[13px] inline-flex items-center justify-center gap-1.5"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    View all {product.variants.length} variants
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Variants Drawer ─────────────────────────── */
function VariantsDrawer({
  product,
  onClose,
  onUpdate,
}: {
  product: Product;
  onClose: () => void;
  onUpdate: (p: Product) => void;
}) {
  // Group variants by option name for the "T-Shirt" style matrix view
  const groupedByFirstOption = useMemo(() => {
    if (product.variantOptions.length === 0) return [];
    const first = product.variantOptions[0].name;
    const map = new Map<string, ProductVariant[]>();
    product.variants.forEach((v) => {
      const key = v.options.find((o) => o.name === first)?.value || '—';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    });
    return Array.from(map.entries());
  }, [product]);

  const updateVariant = (id: string, patch: Partial<ProductVariant>) => {
    const next: Product = {
      ...product,
      variants: product.variants.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    };
    onUpdate(next);
  };

  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border-l border-slate-200 w-full max-w-3xl h-full overflow-y-auto shadow-xl flex flex-col"
      >
        {/* Header */}
        <div className="px-3 py-3 border-b border-slate-200 sticky top-0 bg-white z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-9 h-9 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold text-slate-900 truncate">Variants — {product.name}</h3>
              <p className="text-[13px] text-slate-500">
                {product.variants.length} variants · {totalStock} total stock
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
          {/* Option summary */}
          {product.variantOptions.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-2">
              <div className="text-[13px] font-medium text-slate-700">Option groups</div>
              {product.variantOptions.map((opt) => (
                <div key={opt.name} className="text-[13px]">
                  <div className="flex items-center gap-1.5 text-slate-600 mb-1">
                    {opt.name === 'Color' ? <Palette className="w-3 h-3" /> :
                      opt.name === 'Size' ? <Ruler className="w-3 h-3" /> :
                        <Box className="w-3 h-3" />}
                    <span className="font-medium">{opt.name}</span>
                    <span className="text-slate-400">({opt.values.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {opt.values.map((v) => (
                      <span key={v} className="text-[13px] bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-sm">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Grouped matrix */}
          <div className="space-y-3">
            {groupedByFirstOption.map(([groupName, variants]) => (
              <div key={groupName} className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                  {product.variantOptions[0]?.name === 'Color' ? <Palette className="w-3.5 h-3.5 text-slate-500" /> :
                    product.variantOptions[0]?.name === 'Size' ? <Ruler className="w-3.5 h-3.5 text-slate-500" /> :
                      <Box className="w-3.5 h-3.5 text-slate-500" />}
                  <span className="text-[13px] font-medium text-slate-700">
                    {product.variantOptions[0]?.name}: {groupName}
                  </span>
                  <span className="text-[13px] text-slate-400">({variants.length})</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500">
                        <th className="py-2 px-3 font-medium">Variant</th>
                        <th className="py-2 px-3 font-medium">SKU</th>
                        <th className="py-2 px-3 font-medium text-right">Price</th>
                        <th className="py-2 px-3 font-medium text-right">Stock</th>
                        <th className="py-2 px-3 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {variants.map((v) => {
                        const remaining = v.options.slice(1);
                        const label = remaining.length > 0 ? remaining.map((o) => o.value).join(' / ') : 'Default';
                        const stockBadge =
                          v.stock === 0
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : v.stock <= 3
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                        return (
                          <tr key={v.id} className="hover:bg-slate-50 transition">
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-sm bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                                  <Box className="w-3.5 h-3.5" />
                                </div>
                                <span className="font-medium text-slate-900">{label}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                value={v.sku}
                                onChange={(e) => updateVariant(v.id, { sku: e.target.value })}
                                className="w-full max-w-[180px] bg-white border border-slate-200 rounded-sm px-2 py-1 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                value={v.price}
                                onChange={(e) => updateVariant(v.id, { price: Number(e.target.value) })}
                                className="w-24 bg-white border border-slate-200 rounded-sm px-2 py-1 text-[13px] text-right focus:outline-none focus:ring-1 focus:ring-blue-950"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                value={v.stock}
                                onChange={(e) => updateVariant(v.id, { stock: Number(e.target.value) })}
                                className="w-20 bg-white border border-slate-200 rounded-sm px-2 py-1 text-[13px] text-right focus:outline-none focus:ring-1 focus:ring-blue-950"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${stockBadge}`}>
                                {v.stock === 0 ? 'Out' : v.stock <= 3 ? 'Low' : 'In Stock'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* T-Shirt example footnote */}
          <div className="bg-blue-50 border border-blue-100 rounded-sm p-2 text-[13px] text-blue-900">
            <div className="flex items-center gap-1.5 font-medium">
              <Layers className="w-3.5 h-3.5" />
              Example matrix
            </div>
            <p className="mt-1 text-slate-600">
              T-Shirt → Black / S, Black / M, Black / L, White / S, White / M, White / L.
              Each combination is tracked with its own SKU, price, and stock.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── FilterDropdown ─────────────────────────── */
function FilterDropdown({
  label,
  value,
  options,
  labels,
  onChange,
  icon,
  align = 'start',
}: {
  label: string;
  value: string | null;
  options: string[];
  labels?: Record<string, string>;
  onChange: (v: string | null) => void;
  icon?: React.ReactNode;
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', onDoc);
      document.addEventListener('keydown', onKey);
    }
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const display = value ? labels?.[value] ?? value : label;
  const isActive = value !== null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 border rounded-sm px-3 py-2 text-[13px] font-medium transition whitespace-nowrap ${isActive
            ? 'bg-blue-50 border-blue-950 text-blue-950'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
      >
        {icon}
        {display}
        <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute top-full mt-1 w-56 rounded-sm border border-slate-200 bg-white shadow-lg z-50 p-1 ${align === 'end' ? 'right-0' : 'left-0'
            }`}
        >
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`w-full text-left px-2 py-2 rounded-sm text-[13px] ${!isActive ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
              }`}
          >
            All {label.toLowerCase()}
          </button>
          <div className="border-t border-slate-100 my-1" />
          {options.map((opt) => {
            const isSelected = value === opt;
            return (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-2 py-2 rounded-sm text-[13px] flex items-center justify-between ${isSelected ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
                  }`}
              >
                <span>{labels?.[opt] ?? opt}</span>
                {isSelected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Kebab menu ─────────────────────────── */
function KebabMenu({
  onEdit,
  onDuplicate,
  onView,
  onDelete,
  align = 'right',
}: {
  onEdit: () => void;
  onDuplicate: () => void;
  onView: () => void;
  onDelete: () => void;
  align?: 'left' | 'right';
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`absolute top-full mt-1 w-44 bg-white border border-slate-200 rounded-sm shadow-lg z-50 py-1 ${align === 'right' ? 'right-0' : 'left-0'
        }`}
    >
      <MenuItem icon={<Edit className="w-3.5 h-3.5" />} label="Edit" onClick={onEdit} />
      <MenuItem icon={<Copy className="w-3.5 h-3.5" />} label="Duplicate" onClick={onDuplicate} />
      <MenuItem icon={<ExternalLink className="w-3.5 h-3.5" />} label="View on store" onClick={onView} />
      <div className="border-t border-slate-100 my-1" />
      <MenuItem icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete" onClick={onDelete} danger />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left transition ${danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'
        }`}
    >
      <span className={danger ? 'text-red-500' : 'text-slate-400'}>{icon}</span>
      {label}
    </button>
  );
}

/* ─────────────────────────── Popup wrapper ─────────────────────────── */
function Popup({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl"
      >
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────────── Stat ─────────────────────────── */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm p-2">
      <p className="text-[13px] font-medium text-slate-500">{label}</p>
      <p className="text-[13px] font-semibold text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}