'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Package,
  AlertTriangle,
  XCircle,
  Search,
  ChevronDown,
  Upload,
  Check,
  X,
  FileSpreadsheet,
  History,
  Loader2,
} from 'lucide-react';

// --- TYPES ---
type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';
type AdjustmentType = 'Add' | 'Remove' | 'Set';
type AdjustmentReason = 'Restock' | 'Damaged' | 'Return' | 'Correction';

interface StockHistoryItem {
  id: string;
  date: string;
  user: string;
  change: string;
  reason: string;
  notes?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  image: string;
  category: string;
  brand: string;
  warehouse: string;
  currentStock: number;
  reserved: number;
  available: number;
  threshold: number;
  status: StockStatus;
  history: StockHistoryItem[];
}

const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-1', name: 'Lenovo ThinkPad X1 Carbon Gen 10', sku: 'LNV-TPX1-G10', image: '/Lenovo.jpeg',
    category: 'Laptops & Workstations', brand: 'Lenovo', warehouse: 'Nairobi Main Hub',
    currentStock: 35, reserved: 5, available: 30, threshold: 10, status: 'In Stock',
    history: [
      { id: 'h-1', date: '2026-09-20 14:32', user: 'Admin Isaac', change: '+15', reason: 'Restock', notes: 'Monthly container shipment arrival' },
      { id: 'h-2', date: '2026-09-12 09:15', user: 'System', change: '-2', reason: 'Correction', notes: 'Order fulfillment dispatch' },
    ],
  },
  {
    id: 'inv-2', name: 'Dell UltraSharp 27 4K USB-C Monitor', sku: 'DEL-U2723QE', image: '/dellmonitor.jpeg',
    category: 'Displays & Monitors', brand: 'Dell Technologies', warehouse: 'Mombasa Port Depot',
    currentStock: 6, reserved: 2, available: 4, threshold: 8, status: 'Low Stock',
    history: [
      { id: 'h-3', date: '2026-09-18 11:00', user: 'Admin Isaac', change: '-4', reason: 'Damaged', notes: 'Screen cracked during transit handling' },
    ],
  },
  {
    id: 'inv-3', name: 'Apple iPhone 15 Pro Max 256GB', sku: 'APL-IP15PM-256', image: '/phone.jpeg',
    category: 'Smartphones & 5G', brand: 'Apple', warehouse: 'Nairobi Main Hub',
    currentStock: 0, reserved: 0, available: 0, threshold: 5, status: 'Out of Stock',
    history: [
      { id: 'h-4', date: '2026-09-22 16:45', user: 'System', change: '-5', reason: 'Restock', notes: 'All units sold out via WhatsApp store' },
    ],
  },
  {
    id: 'inv-4', name: 'Logitech MX Master 3S Wireless Mouse', sku: 'LOG-MXM3S-BLK', image: '/phone.jpeg',
    category: 'Keyboards & Mice', brand: 'Logitech', warehouse: 'Westlands Fulfilment',
    currentStock: 48, reserved: 8, available: 40, threshold: 12, status: 'In Stock',
    history: [
      { id: 'h-5', date: '2026-09-15 10:20', user: 'Admin Isaac', change: '+25', reason: 'Restock', notes: 'Supplier delivery batch #892' },
    ],
  },
  {
    id: 'inv-5', name: 'Samsung Odyssey OLED G9 Monitor', sku: 'SAM-G95SC-49', image: '/phone.jpeg',
    category: 'Displays & Monitors', brand: 'Samsung', warehouse: 'Nairobi Main Hub',
    currentStock: 3, reserved: 1, available: 2, threshold: 5, status: 'Low Stock',
    history: [
      { id: 'h-6', date: '2026-09-10 14:00', user: 'Admin Isaac', change: '+3', reason: 'Restock', notes: 'Special order import' },
    ],
  },
];

const CATEGORIES = ['Laptops & Workstations', 'Displays & Monitors', 'Smartphones & 5G', 'Keyboards & Mice'];
const BRANDS = ['Lenovo', 'Dell Technologies', 'Apple', 'Samsung', 'Logitech'];
const STATUSES: StockStatus[] = ['In Stock', 'Low Stock', 'Out of Stock'];
const WAREHOUSES = ['Nairobi Main Hub', 'Mombasa Port Depot', 'Westlands Fulfilment'];

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StockStatus | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [cardFilter, setCardFilter] = useState<'All' | 'Low Stock' | 'Out of Stock'>('All');

  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [activeSheetItem, setActiveSheetItem] = useState<InventoryItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [adjType, setAdjType] = useState<AdjustmentType>('Add');
  const [adjQty, setAdjQty] = useState('10');
  const [adjReason, setAdjReason] = useState<AdjustmentReason>('Restock');
  const [adjNotes, setAdjNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [bulkManualRows, setBulkManualRows] = useState<{ id: string; name: string; sku: string; current: number; newQty: string }[]>([]);

  useEffect(() => {
    if (isBulkModalOpen) {
      setBulkManualRows(
        inventory.map((i) => ({
          id: i.id,
          name: i.name,
          sku: i.sku,
          current: i.currentStock,
          newQty: String(i.currentStock),
        }))
      );
    }
  }, [isBulkModalOpen, inventory]);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const totalSkus = inventory.length;
  const lowStockCount = inventory.filter((i) => i.status === 'Low Stock').length;
  const outOfStockCount = inventory.filter((i) => i.status === 'Out of Stock').length;

  const filteredInventory = inventory.filter((item) => {
    if (cardFilter === 'Low Stock' && item.status !== 'Low Stock') return false;
    if (cardFilter === 'Out of Stock' && item.status !== 'Out of Stock') return false;

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q || item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (selectedCategory && item.category !== selectedCategory) return false;
    if (selectedBrand && item.brand !== selectedBrand) return false;
    if (selectedStatus && item.status !== selectedStatus) return false;
    if (selectedWarehouse && item.warehouse !== selectedWarehouse) return false;
    return true;
  });

  const allSelected = filteredInventory.length > 0 && selectedIds.length === filteredInventory.length;
  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? [] : filteredInventory.map((i) => i.id));
  const toggleRow = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    setIsSaving(true);

    setTimeout(() => {
      const qtyNum = parseInt(adjQty) || 0;
      let newCurrent = adjustItem.currentStock;
      let changeStr = '';

      if (adjType === 'Add') {
        newCurrent += qtyNum;
        changeStr = `+${qtyNum}`;
      } else if (adjType === 'Remove') {
        newCurrent = Math.max(0, newCurrent - qtyNum);
        changeStr = `-${qtyNum}`;
      } else {
        const diff = qtyNum - newCurrent;
        newCurrent = qtyNum;
        changeStr = diff >= 0 ? `+${diff}` : `${diff}`;
      }

      const newAvailable = Math.max(0, newCurrent - adjustItem.reserved);
      let newStatus: StockStatus = 'In Stock';
      if (newCurrent === 0) newStatus = 'Out of Stock';
      else if (newCurrent <= adjustItem.threshold) newStatus = 'Low Stock';

      const newHistory: StockHistoryItem = {
        id: `h-${Date.now()}`,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        user: 'Admin Isaac',
        change: changeStr,
        reason: adjReason,
        notes: adjNotes || `Stock adjusted via ${adjType} operation`,
      };

      setInventory((prev) =>
        prev.map((item) =>
          item.id === adjustItem.id
            ? {
                ...item,
                currentStock: newCurrent,
                available: newAvailable,
                status: newStatus,
                history: [newHistory, ...item.history],
              }
            : item
        )
      );

      setIsSaving(false);
      setAdjustItem(null);
      setAdjQty('10');
      setAdjNotes('');
      setToastMessage(`Updated stock for ${adjustItem.name} (${changeStr} units)`);
    }, 400);
  };

  const handleBulkSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setInventory((prev) =>
        prev.map((item) => {
          const row = bulkManualRows.find((r) => r.id === item.id);
          if (!row) return item;
          const newQty = parseInt(row.newQty) || item.currentStock;
          const diff = newQty - item.currentStock;
          if (diff === 0) return item;

          const newAvailable = Math.max(0, newQty - item.reserved);
          let newStatus: StockStatus = 'In Stock';
          if (newQty === 0) newStatus = 'Out of Stock';
          else if (newQty <= item.threshold) newStatus = 'Low Stock';

          const newHistory: StockHistoryItem = {
            id: `h-${Date.now()}-${Math.random()}`,
            date: new Date().toISOString().replace('T', ' ').substring(0, 16),
            user: 'Admin Isaac',
            change: diff > 0 ? `+${diff}` : `${diff}`,
            reason: 'Correction',
            notes: 'Bulk stock spreadsheet update',
          };

          return {
            ...item,
            currentStock: newQty,
            available: newAvailable,
            status: newStatus,
            history: [newHistory, ...item.history],
          };
        })
      );
      setIsSaving(false);
      setIsBulkModalOpen(false);
      setToastMessage('Bulk inventory updated');
    }, 500);
  };

  const activeFilterCount =
    (cardFilter !== 'All' ? 1 : 0) +
    (selectedCategory ? 1 : 0) +
    (selectedBrand ? 1 : 0) +
    (selectedStatus ? 1 : 0) +
    (selectedWarehouse ? 1 : 0);

  const clearFilters = () => {
    setCardFilter('All');
    setSelectedCategory(null);
    setSelectedBrand(null);
    setSelectedStatus(null);
    setSelectedWarehouse(null);
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {/* TOAST */}
      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Inventory</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Track and update stock levels</p>
          </div>
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Bulk update</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { key: 'All', label: 'Total SKUs', value: totalSkus, Icon: Package, tint: 'bg-blue-50 text-blue-950', activeRing: 'ring-blue-950' },
            { key: 'Low Stock', label: 'Low stock', value: lowStockCount, Icon: AlertTriangle, tint: 'bg-amber-50 text-amber-700', activeRing: 'ring-amber-500' },
            { key: 'Out of Stock', label: 'Out of stock', value: outOfStockCount, Icon: XCircle, tint: 'bg-red-50 text-red-600', activeRing: 'ring-red-500' },
          ].map(({ key, label, value, Icon, tint, activeRing }) => {
            const active = cardFilter === key;
            return (
              <button
                key={key}
                onClick={() => setCardFilter(key as any)}
                className={`text-left bg-white border rounded-sm p-2 flex items-center justify-between gap-2 transition ${
                  active ? `border-blue-950 ring-1 ${activeRing}` : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-500 truncate">{label}</p>
                  <p className="text-[15px] font-bold text-slate-900 mt-0.5">{value}</p>
                </div>
                <span className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 ${tint}`}>
                  <Icon className="w-4 h-4" />
                </span>
              </button>
            );
          })}
        </div>

        {/* FILTER BAR */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search products or SKU…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown label="Category" value={selectedCategory} options={CATEGORIES} onChange={setSelectedCategory} />
            <FilterDropdown label="Brand" value={selectedBrand} options={BRANDS} onChange={setSelectedBrand} />
            <FilterDropdown
              label="Status"
              value={selectedStatus}
              options={STATUSES as unknown as string[]}
              onChange={(v) => setSelectedStatus(v as StockStatus | null)}
            />
            <FilterDropdown label="Warehouse" value={selectedWarehouse} options={WAREHOUSES} onChange={setSelectedWarehouse} />
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
                onClick={() => setIsBulkModalOpen(true)}
                className="bg-blue-900 hover:bg-blue-800 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Bulk update
              </button>
              <button
                onClick={() => alert('Export selected as CSV')}
                className="bg-blue-900 hover:bg-blue-800 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Export CSV
              </button>
            </div>
          </div>
        )}

        {/* TABLE */}
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
                  <th className="py-2 px-3 font-medium">Product / SKU</th>
                  <th className="py-2 px-3 font-medium">Warehouse</th>
                  <th className="py-2 px-3 font-medium text-center">Current</th>
                  <th className="py-2 px-3 font-medium text-center">Reserved</th>
                  <th className="py-2 px-3 font-medium text-center">Available</th>
                  <th className="py-2 px-3 font-medium text-center">Threshold</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 text-[13px]">
                      No inventory items match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => {
                    const statusBadge =
                      item.status === 'In Stock'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : item.status === 'Low Stock'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-red-50 text-red-600 border-red-200';
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => setActiveSheetItem(item)}
                      >
                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            onChange={() => toggleRow(item.id)}
                            className="rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate max-w-[240px]">{item.name}</p>
                              <p className="font-mono text-[13px] text-slate-400">{item.sku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-slate-600">{item.warehouse}</td>
                        <td className="py-2 px-3 text-center font-medium text-slate-900">{item.currentStock}</td>
                        <td className="py-2 px-3 text-center text-slate-500">{item.reserved}</td>
                        <td className="py-2 px-3 text-center font-medium text-blue-950">{item.available}</td>
                        <td className="py-2 px-3 text-center text-slate-400 font-mono">{item.threshold}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${statusBadge}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setAdjustItem(item)}
                            className="bg-white border border-slate-200 hover:bg-blue-950 hover:border-blue-950 hover:text-white text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] transition"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ---- ADJUST MODAL ---- */}
      {adjustItem && (
        <Modal onClose={() => setAdjustItem(null)} title="Adjust stock" subtitle={adjustItem.name}>
          <form onSubmit={handleAdjustSubmit} className="space-y-3 text-[13px]">
            <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 flex items-center justify-between">
              <span className="text-slate-600">Current stock</span>
              <span className="font-medium text-slate-900 bg-white px-3 py-0.5 rounded-sm border border-slate-200">
                {adjustItem.currentStock} units
              </span>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Adjustment type</label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-0.5 rounded-sm">
                {(['Add', 'Remove', 'Set'] as AdjustmentType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAdjType(t)}
                    className={`py-2 rounded-sm text-[13px] font-medium transition ${
                      adjType === t
                        ? t === 'Add'
                          ? 'bg-emerald-600 text-white'
                          : t === 'Remove'
                          ? 'bg-red-600 text-white'
                          : 'bg-blue-950 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t === 'Add' ? 'Add (+)' : t === 'Remove' ? 'Remove (−)' : 'Set (=)'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Quantity *</label>
              <input
                type="number"
                min="0"
                required
                value={adjQty}
                onChange={(e) => setAdjQty(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Reason</label>
              <select
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value as AdjustmentReason)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              >
                <option value="Restock">Restock</option>
                <option value="Damaged">Damaged</option>
                <option value="Return">Customer return</option>
                <option value="Correction">Inventory correction</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Notes (optional)</label>
              <textarea
                rows={2}
                placeholder="Add context…"
                value={adjNotes}
                onChange={(e) => setAdjNotes(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAdjustItem(null)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {isSaving ? 'Updating…' : 'Confirm'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ---- BULK MODAL ---- */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white border border-slate-200 rounded-sm max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <h2 className="text-[15px] font-semibold text-slate-900">Bulk stock update</h2>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
              <label
                className="block border-2 border-dashed border-slate-300 hover:border-blue-950 hover:bg-blue-50/20 rounded-sm p-6 text-center cursor-pointer transition"
                onDragOver={(e) => e.preventDefault()}
              >
                <Upload className="w-7 h-7 mx-auto text-slate-400" />
                <p className="text-[13px] font-medium text-slate-900 mt-2">Upload CSV spreadsheet</p>
                <p className="text-[13px] text-slate-500 mt-0.5">Columns: SKU, New Quantity</p>
                <span className="inline-block mt-2 bg-white border border-slate-200 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]">
                  Browse files
                </span>
              </label>

              <div>
                <p className="font-medium text-slate-700 mb-1">Manual entry</p>
                <div className="border border-slate-200 rounded-sm overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                        <th className="py-2 px-3 font-medium">Product / SKU</th>
                        <th className="py-2 px-3 font-medium text-center">Current</th>
                        <th className="py-2 px-3 font-medium text-center">New</th>
                        <th className="py-2 px-3 font-medium text-center">Diff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bulkManualRows.map((row) => {
                        const newQ = parseInt(row.newQty) || row.current;
                        const diff = newQ - row.current;
                        return (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3">
                              <p className="font-medium text-slate-900 truncate max-w-[220px]">{row.name}</p>
                              <p className="font-mono text-[13px] text-slate-400">{row.sku}</p>
                            </td>
                            <td className="py-2 px-3 text-center text-slate-600">{row.current}</td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="number"
                                value={row.newQty}
                                onChange={(e) =>
                                  setBulkManualRows((prev) =>
                                    prev.map((r) => (r.id === row.id ? { ...r, newQty: e.target.value } : r))
                                  )
                                }
                                className="w-20 bg-white border border-slate-200 rounded-sm px-2 py-1 text-center font-medium text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-sm text-[13px] font-medium ${
                                  diff > 0
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : diff < 0
                                    ? 'bg-red-50 text-red-600'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkSave}
                disabled={isSaving}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {isSaving ? 'Saving…' : 'Apply updates'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- HISTORY DRAWER ---- */}
      {activeSheetItem && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end"
          onClick={() => setActiveSheetItem(null)}
        >
          <div
            className="bg-white border-l border-slate-200 w-full max-w-md h-full flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                  <History className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-slate-900">Stock history</h2>
                  <p className="text-[13px] text-slate-500 truncate">{activeSheetItem.name}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveSheetItem(null)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
              <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[13px] text-slate-500">Current</p>
                  <p className="text-[15px] font-bold text-slate-900 mt-0.5">{activeSheetItem.currentStock}</p>
                </div>
                <div>
                  <p className="text-[13px] text-slate-500">Reserved</p>
                  <p className="text-[15px] font-bold text-slate-700 mt-0.5">{activeSheetItem.reserved}</p>
                </div>
                <div>
                  <p className="text-[13px] text-slate-500">Available</p>
                  <p className="text-[15px] font-bold text-blue-950 mt-0.5">{activeSheetItem.available}</p>
                </div>
              </div>

              <div>
                <p className="font-medium text-slate-700 mb-2">Audit trail</p>
                <ul className="space-y-2">
                  {activeSheetItem.history.map((h, idx) => {
                    const positive = h.change.startsWith('+');
                    return (
                      <li
                        key={h.id || idx}
                        className="bg-white border border-slate-200 rounded-sm p-2 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-900">{h.reason}</span>
                          <span
                            className={`font-mono px-2 py-0.5 rounded-sm text-[13px] font-medium ${
                              positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                            }`}
                          >
                            {h.change}
                          </span>
                        </div>
                        {h.notes && <p className="text-[13px] text-slate-600">{h.notes}</p>}
                        <div className="flex items-center justify-between text-[13px] text-slate-400 pt-1 border-t border-slate-100">
                          <span>{h.user}</span>
                          <span>{h.date}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[13px] text-slate-500 font-mono">SKU: {activeSheetItem.sku}</span>
              <button
                onClick={() => {
                  const item = activeSheetItem;
                  setActiveSheetItem(null);
                  setAdjustItem(item);
                }}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Adjust stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── FilterDropdown ─────────── */
function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
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
        {value ?? label}
        <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 w-56 rounded-sm border border-slate-200 bg-white shadow-lg z-50 p-1">
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
            const selected = value === opt;
            return (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-2 py-2 rounded-sm text-[13px] flex items-center justify-between ${
                  selected ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{opt}</span>
                {selected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────── Modal ─────────── */
function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-sm max-w-md w-full max-h-[90vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="text-[13px] text-slate-500 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{children}</div>
      </div>
    </div>
  );
}