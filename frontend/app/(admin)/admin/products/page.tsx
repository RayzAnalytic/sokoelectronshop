'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Copy,
  ExternalLink,
  Trash2,
  ChevronDown,
  X,
  AlertTriangle,
  Check,
  LayoutGrid,
  List as ListIcon,
  ArrowUpDown,
} from 'lucide-react';
import AddProductModal from '@/components/admin/AddProductModal';

// --- TYPES ---
type ProductStatus = 'Published' | 'Draft' | 'Archived';
type ViewMode = 'table' | 'cards';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand: string;
  price: number;
  stock: number;
  status: ProductStatus;
  image: string;
}

const INITIAL_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Apex Ultra X1 Pro Smartphone 5G', sku: 'APX-X1-5G', category: 'Smartphones', brand: 'Apex', price: 89999, stock: 14, status: 'Published', image: '/phone.jpeg' },
  { id: 'p2', name: 'Zenith StudioBook Pro 16 Laptop', sku: 'ZNT-SB16-L', category: 'Laptops', brand: 'Zenith', price: 149999, stock: 3, status: 'Published', image: '/Lenovo.jpeg' },
  { id: 'p3', name: 'Dell UltraSharp 27" 4K Hub Monitor', sku: 'DLL-U27-4K', category: 'Displays', brand: 'Dell', price: 45000, stock: 5, status: 'Published', image: '/dellmonitor.jpeg' },
  { id: 'p4', name: 'Wireless Mechanical Keyboard K2', sku: 'MCH-K2-WL', category: 'Accessories', brand: 'Keychron', price: 12999, stock: 24, status: 'Published', image: '/phone.jpeg' },
  { id: 'p5', name: 'Ergonomic Office Chair Executive', sku: 'ERG-CHR-01', category: 'Furniture', brand: 'ErgoFlex', price: 34999, stock: 0, status: 'Draft', image: '/Lenovo.jpeg' },
  { id: 'p6', name: 'Logitech MX Master 3S Wireless Mouse', sku: 'LOG-MX3S-M', category: 'Accessories', brand: 'Logitech', price: 14500, stock: 8, status: 'Published', image: '/phone.jpeg' },
  { id: 'p7', name: 'Sony WH-1000XM5 Noise Cancelling', sku: 'SNY-WH5-BLK', category: 'Audio', brand: 'Sony', price: 42000, stock: 1, status: 'Published', image: '/phone.jpeg' },
  { id: 'p8', name: 'Anker Prime 24,000mAh Power Bank', sku: 'ANK-P24K-PB', category: 'Accessories', brand: 'Anker', price: 18500, stock: 35, status: 'Archived', image: '/phone.jpeg' },
];

const CATEGORIES = ['Smartphones', 'Laptops', 'Displays', 'Accessories', 'Furniture', 'Audio'];
const BRANDS = ['Apex', 'Zenith', 'Dell', 'Keychron', 'ErgoFlex', 'Logitech', 'Sony', 'Anker'];
const STATUSES: ProductStatus[] = ['Published', 'Draft', 'Archived'];

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

  const anyModalOpen =
    addOpen || deleteProductId !== null || editProduct !== null || viewProduct !== null || duplicateProduct !== null;

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
            <p className="text-[13px] text-slate-500 mt-0.5">Manage your product catalog</p>
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
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 text-[13px]">
                        No products match your filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => {
                      const stockBadge =
                        p.stock === 0
                          ? 'bg-red-50 text-red-600 border-red-200'
                          : p.stock <= 10
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
                          <td className="py-2 px-3 font-medium text-slate-900 max-w-[280px] truncate">{p.name}</td>
                          <td className="py-2 px-3 text-slate-500 font-mono">{p.sku}</td>
                          <td className="py-2 px-3 text-slate-600">{p.category}</td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-900">{formatKES(p.price)}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${stockBadge}`}>
                              {p.stock}
                            </span>
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
                  : p.stock <= 10
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
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[13px] font-bold text-slate-900">{formatKES(p.price)}</span>
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

      {/* ---- ADD PRODUCT MODAL (shared component) ---- */}
      <AddProductModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={(data: any) => {
          const newProduct: Product = {
            id: `p-${Date.now()}`,
            name: data.name || 'Untitled',
            sku: data.sku || `SKU-${Math.floor(Math.random() * 90000)}`,
            category: data.category || 'Accessories',
            brand: data.brand || 'Generic',
            price: Number(data.price) || 0,
            stock: Number(data.stock) || 0,
            status: data.status === 'draft' ? 'Draft' : 'Published',
            image: data.images?.[0] || '/phone.jpeg',
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
            This cannot be undone. The product will be permanently removed from your catalog.
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
                <span className="block font-medium text-slate-700 mb-1">Stock</span>
                <input
                  type="number"
                  value={editProduct.stock}
                  onChange={(e) => setEditProduct({ ...editProduct, stock: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </label>
            </div>
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

      {/* ---- VIEW ON STORE ---- */}
      {viewProduct && (
        <Popup onClose={() => setViewProduct(null)}>
          <div className="text-center space-y-2">
            <img
              src={viewProduct.image}
              alt={viewProduct.name}
              className="w-24 h-24 object-cover mx-auto rounded-sm border border-slate-200"
            />
            <p className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">{viewProduct.category}</p>
            <h3 className="text-[15px] font-semibold text-slate-900">{viewProduct.name}</h3>
            <p className="text-[13px] text-slate-500 font-mono">SKU: {viewProduct.sku}</p>
            <p className="text-[15px] font-bold text-slate-900">{formatKES(viewProduct.price)}</p>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setViewProduct(null)}
              className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]"
            >
              Close
            </button>
            <button
              onClick={() => {
                alert(`Opening storefront for ${viewProduct.name}`);
                setViewProduct(null);
              }}
              className="flex-1 bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 rounded-sm text-[13px] inline-flex items-center justify-center gap-1.5"
            >
              View store
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </Popup>
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
        className={`flex items-center gap-1.5 border rounded-sm px-3 py-2 text-[13px] font-medium transition whitespace-nowrap ${
          isActive
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
          className={`absolute top-full mt-1 w-56 rounded-sm border border-slate-200 bg-white shadow-lg z-50 p-1 ${
            align === 'end' ? 'right-0' : 'left-0'
          }`}
        >
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`w-full text-left px-2 py-2 rounded-sm text-[13px] ${
              !isActive ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
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
                className={`w-full text-left px-2 py-2 rounded-sm text-[13px] flex items-center justify-between ${
                  isSelected ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
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
      className={`absolute top-full mt-1 w-44 bg-white border border-slate-200 rounded-sm shadow-lg z-50 py-1 ${
        align === 'right' ? 'right-0' : 'left-0'
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
      className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left transition ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'
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