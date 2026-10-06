'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Package, AlertTriangle, XCircle, Search, ChevronDown,
  Check, X, History, Loader2, TrendingUp, ArrowUpRight,
  ArrowDownRight, Layers, Boxes, RefreshCw, ExternalLink,
} from 'lucide-react';

import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import type {
  AdminInventoryItem,
  AdminStockMovement,
  AdminStockMovementReason,
  AdminStockStatus,
  AdminAdjustType,
} from '@/lib/admin-types';

/* ─────────────────────────────────────────────────────────────
   LOCAL ALIASES
───────────────────────────────────────────────────────────── */
type StockStatus = AdminStockStatus;
type AdjustmentType = AdminAdjustType;
type SectionTab = 'stock' | 'movements';

/**
 * The Adjust modal's Reason dropdown. The stored value on the
 * StockMovement row is the `value` (lowercased). The label is what
 * the admin sees. The backend accepts any string for `reason`, so
 * adding entries here doesn't require a backend change.
 */
const ADJUSTMENT_REASONS: { label: string; value: string }[] = [
  { label: 'Restock', value: 'restock' },
  { label: 'Damaged', value: 'damage' },
  { label: 'Customer return', value: 'return' },
  { label: 'Inventory correction', value: 'correction' },
];

const MOVEMENT_STYLES: Record<AdminStockMovementReason, string> = {
  sale: 'bg-blue-50 text-blue-950 border-blue-100',
  restock: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  adjustment: 'bg-slate-100 text-slate-700 border-slate-200',
  damage: 'bg-red-50 text-red-600 border-red-100',
  return: 'bg-amber-50 text-amber-700 border-amber-100',
  correction: 'bg-slate-100 text-slate-700 border-slate-200',
  transfer_in: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  transfer_out: 'bg-violet-50 text-violet-700 border-violet-100',
};

const MOVEMENT_LABELS: Record<AdminStockMovementReason, string> = {
  sale: 'Sale',
  restock: 'Restock',
  adjustment: 'Adjustment',
  damage: 'Damage',
  return: 'Return',
  correction: 'Correction',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
};

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────── */
export default function InventoryPage() {
  // ── Data ────────────────────────────────────────────────────
  const [items, setItems] = useState<AdminInventoryItem[]>([]);
  const [movements, setMovements] = useState<AdminStockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── UI state ────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<SectionTab>('stock');

  // Stock tab filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StockStatus | null>(null);
  const [cardFilter, setCardFilter] = useState<'All' | 'Low Stock' | 'Out of Stock'>('All');

  // Movements tab filters
  const [movementTypeFilter, setMovementTypeFilter] = useState<AdminStockMovementReason | null>(null);
  const [movementSearch, setMovementSearch] = useState('');

  // Modals
  const [adjustItem, setAdjustItem] = useState<AdminInventoryItem | null>(null);
  const [activeSheetItem, setActiveSheetItem] = useState<AdminInventoryItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Adjust form state
  const [adjType, setAdjType] = useState<AdjustmentType>('Add');
  const [adjQty, setAdjQty] = useState('0');
  const [adjReason, setAdjReason] = useState('restock');
  const [adjNotes, setAdjNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset the Adjust form each time the modal opens, so a "Set"
  // operation starts at the current stock instead of a stale value.
  useEffect(() => {
    if (!adjustItem) return;
    setAdjType('Add');
    setAdjQty('0');
    setAdjReason('restock');
    setAdjNotes('');
  }, [adjustItem]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // ── Load on mount ───────────────────────────────────────────
  const loadData = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [inv, mov] = await Promise.all([
        adminApi.inventory.list(signal),
        adminApi.inventory.movements(signal),
      ]);
      setItems(inv);
      setMovements(mov);
    } catch (err) {
      if (signal?.aborted) return;
      setLoadError(
        err instanceof ApiError
          ? err.message || 'Could not load inventory.'
          : 'Could not load inventory.',
      );
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void loadData(ctrl.signal);
    return () => ctrl.abort();
  }, [loadData]);

  // ── Derived lists ───────────────────────────────────────────
  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category))).sort(),
    [items],
  );
  const brands = useMemo(
    () => Array.from(new Set(items.map((i) => i.brand))).sort(),
    [items],
  );

  // Summary
  const totalSkus = items.length;
  const lowStockCount = items.filter((i) => i.status === 'Low Stock').length;
  const outOfStockCount = items.filter((i) => i.status === 'Out of Stock').length;
  const totalReserved = items.reduce((a, i) => a + i.reserved, 0);
  const totalAvailable = items.reduce((a, i) => a + i.available, 0);

  // Filtered inventory
  const filteredInventory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (cardFilter === 'Low Stock' && item.status !== 'Low Stock') return false;
      if (cardFilter === 'Out of Stock' && item.status !== 'Out of Stock') return false;
      if (q && !item.name.toLowerCase().includes(q) && !item.sku.toLowerCase().includes(q)) {
        return false;
      }
      if (selectedCategory && item.category !== selectedCategory) return false;
      if (selectedBrand && item.brand !== selectedBrand) return false;
      if (selectedStatus && item.status !== selectedStatus) return false;
      return true;
    });
  }, [items, searchQuery, cardFilter, selectedCategory, selectedBrand, selectedStatus]);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    const q = movementSearch.trim().toLowerCase();
    return movements.filter((m) => {
      if (movementTypeFilter && m.type !== movementTypeFilter) return false;
      if (
        q &&
        !m.productName.toLowerCase().includes(q) &&
        !m.sku.toLowerCase().includes(q) &&
        !m.reference.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [movements, movementTypeFilter, movementSearch]);

  // Per-SKU history for the drawer. The backend caps the movements
  // list at 500 rows, so this is a client-side filter over the
  // already-fetched ledger. If the cap ever becomes a problem, add
  // a `GET /movements/?sku=…` query and pass it through here.
  const activeSkuHistory = useMemo(() => {
    if (!activeSheetItem) return [];
    return movements.filter((m) => m.sku === activeSheetItem.sku);
  }, [movements, activeSheetItem]);

  const activeFilterCount =
    (cardFilter !== 'All' ? 1 : 0) +
    (selectedCategory ? 1 : 0) +
    (selectedBrand ? 1 : 0) +
    (selectedStatus ? 1 : 0);

  const clearFilters = () => {
    setCardFilter('All');
    setSelectedCategory(null);
    setSelectedBrand(null);
    setSelectedStatus(null);
    setSearchQuery('');
  };

  // ── Adjust ──────────────────────────────────────────────────
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem || isSaving) return;

    const qty = parseInt(adjQty, 10);
    if (!Number.isFinite(qty) || qty < 0) {
      setToastMessage('Enter a valid non-negative quantity.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await adminApi.inventory.adjust({
        productId: adjustItem.id,
        type: adjType,
        quantity: qty,
        reason: adjReason,
        notes: adjNotes.trim() || undefined,
      });

      // Replace the row in place.
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));

      // Refresh movements so the new ledger row shows up. Cheap
      // because the endpoint is small and the list is capped.
      try {
        const fresh = await adminApi.inventory.movements();
        setMovements(fresh);
      } catch {
        /* non-fatal — the row will appear on next page load */
      }

      setAdjustItem(null);
      setToastMessage(`Stock updated for ${updated.name}`);
    } catch (err) {
      setToastMessage(
        err instanceof ApiError
          ? err.message || 'Could not adjust stock.'
          : 'Could not adjust stock.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  /* ─────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {/* TOAST */}
      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px] max-w-md">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="leading-relaxed">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Inventory</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Stock levels and movement history
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/suppliers"
              className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-600 hover:text-blue-950 transition"
            >
              Manage suppliers
              <ExternalLink className="w-3 h-3" />
            </Link>
            <button
              onClick={() => void loadData()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="max-w-[1600px] mx-auto px-3 flex gap-0.5 overflow-x-auto">
          {[
            { id: 'stock' as const, label: 'Stock Levels', icon: Boxes },
            { id: 'movements' as const, label: 'Inventory Movements', icon: TrendingUp },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium border-b-2 transition whitespace-nowrap ${isActive
                    ? 'border-blue-950 text-blue-950 bg-blue-50/30'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-950' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* LOADING / ERROR */}
        {isLoading && items.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-sm p-12 text-center">
            <Loader2 className="w-5 h-5 mx-auto text-slate-300 animate-spin" />
            <p className="text-[13px] text-slate-500 mt-2">Loading inventory…</p>
          </div>
        ) : loadError ? (
          <div className="bg-red-50 border border-red-100 text-red-700 rounded-sm px-3 py-3 flex items-start gap-2 text-[13px]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Could not load inventory</p>
              <p className="text-red-600 mt-0.5">{loadError}</p>
              <button
                onClick={() => void loadData()}
                className="mt-2 text-red-700 hover:underline font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ====================================================== */}
            {/* SECTION: STOCK LEVELS */}
            {/* ====================================================== */}
            {activeSection === 'stock' && (
              <>
                {/* SUMMARY CARDS */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[
                    { key: 'All' as const, label: 'Total SKUs', value: totalSkus, Icon: Package, tint: 'bg-blue-50 text-blue-950', ring: 'ring-blue-950' },
                    { key: 'Low Stock' as const, label: 'Low stock', value: lowStockCount, Icon: AlertTriangle, tint: 'bg-amber-50 text-amber-700', ring: 'ring-amber-500' },
                    { key: 'Out of Stock' as const, label: 'Out of stock', value: outOfStockCount, Icon: XCircle, tint: 'bg-red-50 text-red-600', ring: 'ring-red-500' },
                    { key: null, label: 'Reserved units', value: totalReserved, Icon: Layers, tint: 'bg-indigo-50 text-indigo-700', ring: '' },
                    { key: null, label: 'Available units', value: totalAvailable, Icon: Check, tint: 'bg-emerald-50 text-emerald-700', ring: '' },
                  ].map(({ key, label, value, Icon, tint, ring }, idx) => {
                    const isFilter = key !== null;
                    const active = isFilter && cardFilter === key;
                    return (
                      <button
                        key={idx}
                        onClick={() => isFilter && setCardFilter(key)}
                        disabled={!isFilter}
                        className={`text-left bg-white border rounded-sm p-2 flex items-center justify-between gap-2 transition ${active ? `border-blue-950 ring-1 ${ring}` : 'border-slate-200'
                          } ${isFilter ? 'hover:border-slate-300 cursor-pointer' : 'cursor-default'}`}
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-slate-500 truncate">{label}</p>
                          <p className="text-[15px] font-bold text-slate-900 mt-0.5">
                            {value.toLocaleString()}
                          </p>
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
                    <FilterDropdown label="Category" value={selectedCategory} options={categories} onChange={setSelectedCategory} />
                    <FilterDropdown label="Brand" value={selectedBrand} options={brands} onChange={setSelectedBrand} />
                    <FilterDropdown
                      label="Status"
                      value={selectedStatus}
                      options={['In Stock', 'Low Stock', 'Out of Stock']}
                      onChange={(v) => setSelectedStatus(v as StockStatus | null)}
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

                {/* STOCK TABLE */}
                <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-3 font-medium">Product / SKU</th>
                          <th className="py-2 px-3 font-medium">Category</th>
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
                            <td colSpan={8} className="py-12 text-center text-slate-400 text-[13px]">
                              {items.length === 0
                                ? 'No products in the catalogue yet.'
                                : 'No inventory items match your filters.'}
                            </td>
                          </tr>
                        ) : (
                          filteredInventory.map((item) => {
                            const badge =
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
                                <td className="py-2 px-3">
                                  <div className="flex items-center gap-2">
                                    {item.image ? (
                                      <img
                                        src={item.image}
                                        alt={item.name}
                                        className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0"
                                      />
                                    ) : (
                                      <span className="w-8 h-8 rounded-sm bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                                        <Package className="w-4 h-4" />
                                      </span>
                                    )}
                                    <div className="min-w-0">
                                      <p className="font-medium text-slate-900 truncate max-w-[240px]">{item.name}</p>
                                      <p className="font-mono text-[13px] text-slate-400">{item.sku || item.id}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-slate-600 truncate max-w-[140px]">{item.category}</td>
                                <td className="py-2 px-3 text-center font-medium text-slate-900">{item.currentStock}</td>
                                <td className="py-2 px-3 text-center text-slate-500">{item.reserved}</td>
                                <td className="py-2 px-3 text-center font-medium text-blue-950">{item.available}</td>
                                <td className="py-2 px-3 text-center text-slate-400 font-mono">{item.threshold}</td>
                                <td className="py-2 px-3">
                                  <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${badge}`}>
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
              </>
            )}

            {/* ====================================================== */}
            {/* SECTION: MOVEMENTS */}
            {/* ====================================================== */}
            {activeSection === 'movements' && (
              <>
                {/* SUMMARY */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Movements', value: movements.length, icon: TrendingUp, color: 'text-blue-950 bg-blue-50' },
                    { label: 'Inbound', value: movements.filter((m) => m.quantity > 0).length, icon: ArrowDownRight, color: 'text-emerald-700 bg-emerald-50' },
                    { label: 'Outbound', value: movements.filter((m) => m.quantity < 0).length, icon: ArrowUpRight, color: 'text-red-600 bg-red-50' },
                    { label: 'Net Units', value: movements.reduce((a, m) => a + m.quantity, 0).toLocaleString(), icon: Layers, color: 'text-indigo-700 bg-indigo-50' },
                  ].map((s) => (
                    <div key={s.label} className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-500 truncate">{s.label}</p>
                        <p className="text-[15px] font-bold text-slate-900 mt-0.5">{s.value}</p>
                      </div>
                      <span className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 ${s.color}`}>
                        <s.icon className="w-4 h-4" />
                      </span>
                    </div>
                  ))}
                </div>

                {/* FILTER BAR */}
                <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search by product, SKU, or reference…"
                      value={movementSearch}
                      onChange={(e) => setMovementSearch(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <FilterDropdown
                      label="Type"
                      value={movementTypeFilter}
                      options={Object.keys(MOVEMENT_LABELS)}
                      labels={MOVEMENT_LABELS}
                      onChange={(v) => setMovementTypeFilter(v as AdminStockMovementReason | null)}
                    />
                  </div>
                </div>

                {/* MOVEMENTS TABLE */}
                <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-3 font-medium">Date</th>
                          <th className="py-2 px-3 font-medium">Product / SKU</th>
                          <th className="py-2 px-3 font-medium">Type</th>
                          <th className="py-2 px-3 font-medium text-center">Qty</th>
                          <th className="py-2 px-3 font-medium">Reference</th>
                          <th className="py-2 px-3 font-medium">User</th>
                          <th className="py-2 px-3 font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredMovements.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-slate-400 text-[13px]">
                              {movements.length === 0
                                ? 'No stock movements recorded yet.'
                                : 'No movements match your filters.'}
                            </td>
                          </tr>
                        ) : (
                          filteredMovements.map((m) => (
                            <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2 px-3 text-slate-500 font-mono text-[13px] whitespace-nowrap">
                                {formatMovementDate(m.date)}
                              </td>
                              <td className="py-2 px-3">
                                <p className="font-medium text-slate-900 truncate max-w-[220px]">{m.productName}</p>
                                <p className="font-mono text-[13px] text-slate-400">{m.sku}</p>
                              </td>
                              <td className="py-2 px-3">
                                <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${MOVEMENT_STYLES[m.type]}`}>
                                  {MOVEMENT_LABELS[m.type]}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className={`font-mono font-semibold ${m.quantity >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-700">{m.reference || '—'}</td>
                              <td className="py-2 px-3 text-slate-600 truncate max-w-[160px]">{m.user || 'System'}</td>
                              <td className="py-2 px-3 text-slate-500 truncate max-w-[220px]">{m.notes || '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* ---- ADJUST MODAL ---- */}
      {adjustItem && (
        <Modal onClose={() => !isSaving && setAdjustItem(null)} title="Adjust stock" subtitle={adjustItem.name}>
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
                    className={`py-2 rounded-sm text-[13px] font-medium transition ${adjType === t
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
              <p className="text-[12px] text-slate-400 mt-1">
                {adjType === 'Add'
                  ? `New stock: ${adjustItem.currentStock} + ${parseInt(adjQty, 10) || 0}`
                  : adjType === 'Remove'
                    ? `New stock: ${Math.max(0, adjustItem.currentStock - (parseInt(adjQty, 10) || 0))}`
                    : `New stock: ${parseInt(adjQty, 10) || 0}`}
              </p>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Reason</label>
              <select
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              >
                {ADJUSTMENT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
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
                disabled={isSaving}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                {isSaving ? 'Updating…' : 'Confirm'}
              </button>
            </div>
          </form>
        </Modal>
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
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
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
                <p className="font-medium text-slate-700 mb-2">Recent movements</p>
                {activeSkuHistory.length === 0 ? (
                  <p className="text-[13px] text-slate-400 text-center py-6">
                    No movement history for this product yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {activeSkuHistory.slice(0, 30).map((h) => {
                      const positive = h.quantity >= 0;
                      return (
                        <li key={h.id} className="bg-white border border-slate-200 rounded-sm p-2 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`inline-block px-2 py-0.5 rounded-sm text-[12px] font-medium border ${MOVEMENT_STYLES[h.type]}`}>
                              {MOVEMENT_LABELS[h.type]}
                            </span>
                            <span className={`font-mono px-2 py-0.5 rounded-sm text-[13px] font-medium ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                              {positive ? `+${h.quantity}` : h.quantity}
                            </span>
                          </div>
                          {h.notes && <p className="text-[13px] text-slate-600">{h.notes}</p>}
                          <div className="flex items-center justify-between text-[12px] text-slate-400 pt-1 border-t border-slate-100">
                            <span>{h.user || 'System'}{h.reference ? ` · ${h.reference}` : ''}</span>
                            <span>{formatMovementDate(h.date)}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[13px] text-slate-500 font-mono">
                SKU: {activeSheetItem.sku || activeSheetItem.id}
              </span>
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

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */

/**
 * The backend sends ISO 8601 timestamps. Display them compactly:
 * `03 Oct, 14:32` instead of `2026-10-03T14:32:15Z`.
 */
function formatMovementDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-KE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/* ─────────────────────────────────────────────────────────────
   FILTER DROPDOWN
───────────────────────────────────────────────────────────── */
function FilterDropdown({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  /** Optional display map — value → human label. Defaults to identity. */
  labels?: Record<string, string>;
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
  const display = (v: string) => labels?.[v] ?? v;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 border rounded-sm px-3 py-2 text-[13px] font-medium transition whitespace-nowrap ${isActive
            ? 'bg-blue-50 border-blue-950 text-blue-950'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
      >
        {value ? display(value) : label}
        <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 w-56 rounded-sm border border-slate-200 bg-white shadow-lg z-50 p-1 max-h-72 overflow-y-auto">
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
            const selected = value === opt;
            return (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-2 py-2 rounded-sm text-[13px] flex items-center justify-between ${selected ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
                  }`}
              >
                <span className="truncate">{display(opt)}</span>
                {selected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MODAL
───────────────────────────────────────────────────────────── */
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