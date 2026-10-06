'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    Building2, Plus, Search, ChevronDown, X, Check, Edit, Trash2,
    Eye, Phone, Mail, Globe, MapPin, Package, Loader2,
    AlertTriangle, CheckCircle2, XCircle, Power,
    ChevronLeft, ChevronRight, Calendar, CreditCard, Hash,
    FileSpreadsheet, Activity, Receipt, Clock, Filter,
    ArrowUpDown, User, FileText,
} from 'lucide-react';

import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import type {
    AdminSupplier,
    AdminSupplierWrite,
    AdminSupplierProduct,
    AdminSupplierProductInput,
    AdminSupplierActivity,
    AdminSupplierStatus,
    AdminSupplierType,
    AdminPurchase,
    AdminPurchasePaymentStatus,
    AdminPurchaseStatus,
} from '@/lib/admin-types';

/* ─────────────────────────────────────────────────────────────
   LOCAL ALIASES
───────────────────────────────────────────────────────────── */
type SupplierStatus = AdminSupplierStatus;
type SupplierType = AdminSupplierType;
type PaymentStatus = AdminPurchasePaymentStatus;
type PurchaseStatus = AdminPurchaseStatus;
type SupplierProduct = AdminSupplierProduct;
type Purchase = AdminPurchase;
type ActivityItem = AdminSupplierActivity;
type Supplier = AdminSupplier;

type DrawerTab = 'overview' | 'products' | 'purchases' | 'activity';
type SortKey = 'name' | 'purchases' | 'lastPurchase';

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────── */
const SUPPLIER_TYPES: SupplierType[] = ['Manufacturer', 'Distributor', 'Wholesaler', 'Importer', 'Retailer'];
const COUNTRIES = ['Kenya', 'Uganda', 'Tanzania', 'UAE', 'China', 'India'];
const COUNTIES = ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Kiambu', 'Machakos', 'Kajiado'];
const PAYMENT_TERMS = ['Net 7', 'Net 14', 'Net 30', 'Net 45', 'Net 60', 'Cash on delivery', '50% deposit'];
const PAYMENT_METHODS = ['Bank Transfer', 'M-Pesa', 'Cash', 'Cheque', 'Credit Card'];

/**
 * Temporary catalogue for the "Add products" picker.
 *
 * TODO: replace with `adminApi.products.list()` once the product
 * picker needs real data. The shape here matches what the backend
 * expects on `add-products` — no remapping required when we swap.
 */
const CATALOG_PRODUCTS = [
    { id: 'p-1', name: 'Lenovo ThinkPad X1 Carbon Gen 10', sku: 'LNV-TPX1-G10', image: '/Lenovo.jpeg', category: 'Laptops & Workstations' },
    { id: 'p-2', name: 'Dell UltraSharp 27 4K USB-C Monitor', sku: 'DEL-U2723QE', image: '/dellmonitor.jpeg', category: 'Displays & Monitors' },
    { id: 'p-3', name: 'Apple iPhone 15 Pro Max 256GB', sku: 'APL-IP15PM-256', image: '/phone.jpeg', category: 'Smartphones & 5G' },
    { id: 'p-4', name: 'Logitech MX Master 3S Wireless Mouse', sku: 'LOG-MXM3S-BLK', image: '/phone.jpeg', category: 'Keyboards & Mice' },
    { id: 'p-5', name: 'Samsung Odyssey OLED G9 Monitor', sku: 'SAM-G95SC-49', image: '/phone.jpeg', category: 'Displays & Monitors' },
    { id: 'p-6', name: 'Samsung 55" QLED 4K Smart TV', sku: 'SAM-QN55-4K', image: '/phone.jpeg', category: 'Displays & Monitors' },
    { id: 'p-7', name: 'HP Pavilion 15 Laptop', sku: 'HP-PAV15', image: '/Lenovo.jpeg', category: 'Laptops & Workstations' },
    { id: 'p-8', name: 'Apple AirPods Pro 2nd Gen', sku: 'APL-APP2', image: '/phone.jpeg', category: 'Audio' },
];

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
const formatKES = (n: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n || 0);

const STATUS_STYLES: Record<SupplierStatus, string> = {
    Active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    Inactive: 'bg-slate-100 text-slate-600 border-slate-200',
};

const PAYMENT_STATUS_STYLES: Record<PaymentStatus, string> = {
    Paid: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    Partial: 'bg-amber-50 text-amber-700 border-amber-100',
    Unpaid: 'bg-red-50 text-red-600 border-red-100',
};

const PURCHASE_STATUS_STYLES: Record<PurchaseStatus, string> = {
    Received: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    Pending: 'bg-amber-50 text-amber-700 border-amber-100',
    Cancelled: 'bg-red-50 text-red-600 border-red-100',
};

const ACTIVITY_ICON = {
    created: Building2,
    product_added: Package,
    purchase_recorded: Receipt,
    updated: Edit,
} as const;

const ACTIVITY_COLOR = {
    created: 'bg-blue-50 text-blue-950',
    product_added: 'bg-indigo-50 text-indigo-700',
    purchase_recorded: 'bg-emerald-50 text-emerald-700',
    updated: 'bg-slate-100 text-slate-700',
} as const;

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────── */
export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<SupplierStatus | null>(null);
    const [locationFilter, setLocationFilter] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortAsc, setSortAsc] = useState(true);
    const [page, setPage] = useState(1);
    const pageSize = 8;

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [activeSupplier, setActiveSupplier] = useState<Supplier | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Per-row busy marker. Set while an API call for that supplier is in
    // flight so the row's buttons can disable. `null` when idle.
    const [busyId, setBusyId] = useState<number | null>(null);

    useEffect(() => {
        if (toastMessage) {
            const t = setTimeout(() => setToastMessage(null), 3000);
            return () => clearTimeout(t);
        }
    }, [toastMessage]);

    useEffect(() => { setPage(1); }, [searchQuery, statusFilter, locationFilter, sortKey]);

    // ── Load suppliers on mount ─────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const rows = await adminApi.suppliers.list();
                if (cancelled) return;
                setSuppliers(rows);
            } catch (err) {
                if (cancelled) return;
                setLoadError(
                    err instanceof ApiError
                        ? err.message || 'Could not load suppliers.'
                        : 'Could not load suppliers.',
                );
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // ── Helpers for keeping local state and API in sync ─────────────────
    const replaceSupplier = useCallback((updated: Supplier) => {
        setSuppliers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        setActiveSupplier((prev) => (prev && prev.id === updated.id ? updated : prev));
    }, []);

    const showError = useCallback((err: unknown, fallback: string) => {
        setToastMessage(
            err instanceof ApiError ? err.message || fallback : fallback,
        );
    }, []);

    // ── Summary stats ───────────────────────────────────────────────────
    const totalSuppliers = suppliers.length;
    const activeCount = suppliers.filter((s) => s.status === 'Active').length;
    const inactiveCount = suppliers.filter((s) => s.status === 'Inactive').length;
    const totalProductsSupplied = suppliers.reduce((a, s) => a + s.products.length, 0);
    const totalOutstanding = suppliers.reduce(
        (a, s) => a + s.purchases
            .filter((p) => p.paymentStatus !== 'Paid')
            .reduce((b, p) => b + Number(p.totalAmount || 0), 0),
        0,
    );

    const locations = useMemo(
        () => Array.from(new Set(suppliers.map((s) => `${s.city}, ${s.country}`))).sort(),
        [suppliers],
    );

    // ── Filter + sort ───────────────────────────────────────────────────
    const filtered = useMemo(() => {
        let list = [...suppliers];
        const q = searchQuery.trim().toLowerCase();
        if (q) {
            list = list.filter(
                (s) =>
                    s.name.toLowerCase().includes(q) ||
                    s.company.toLowerCase().includes(q) ||
                    s.email.toLowerCase().includes(q) ||
                    s.phone.toLowerCase().includes(q),
            );
        }
        if (statusFilter) list = list.filter((s) => s.status === statusFilter);
        if (locationFilter) list = list.filter((s) => `${s.city}, ${s.country}` === locationFilter);

        list.sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'name') cmp = a.company.localeCompare(b.company);
            else if (sortKey === 'purchases') {
                const aTotal = a.purchases.reduce((x, p) => x + Number(p.totalAmount || 0), 0);
                const bTotal = b.purchases.reduce((x, p) => x + Number(p.totalAmount || 0), 0);
                cmp = aTotal - bTotal;
            } else if (sortKey === 'lastPurchase') {
                const aLast = a.purchases[0]?.date || '';
                const bLast = b.purchases[0]?.date || '';
                cmp = aLast.localeCompare(bLast);
            }
            return sortAsc ? cmp : -cmp;
        });
        return list;
    }, [suppliers, searchQuery, statusFilter, locationFilter, sortKey, sortAsc]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortAsc(!sortAsc);
        else { setSortKey(key); setSortAsc(true); }
    };

    const clearFilters = () => {
        setSearchQuery(''); setStatusFilter(null); setLocationFilter(null);
    };

    const hasFilters = searchQuery || statusFilter || locationFilter;

    // ── CRUD ────────────────────────────────────────────────────────────

    const handleSaveSupplier = async (data: AdminSupplierWrite, id?: number) => {
        try {
            if (id !== undefined) {
                const updated = await adminApi.suppliers.update(id, data);
                replaceSupplier(updated);
                setToastMessage('Supplier updated');
            } else {
                const created = await adminApi.suppliers.create(data);
                setSuppliers((prev) => [created, ...prev]);
                setToastMessage('Supplier added');
            }
            setIsFormOpen(false);
            setEditingSupplier(null);
        } catch (err) {
            showError(err, 'Could not save supplier.');
            // Re-throw so the form modal keeps its open state and the
            // caller sees the error message inline.
            throw err;
        }
    };

    const toggleStatus = async (id: number) => {
        if (busyId !== null) return;
        setBusyId(id);
        try {
            const updated = await adminApi.suppliers.toggleStatus(id);
            replaceSupplier(updated);
            setToastMessage(`Supplier ${updated.status === 'Active' ? 'activated' : 'deactivated'}`);
        } catch (err) {
            showError(err, 'Could not change supplier status.');
        } finally {
            setBusyId(null);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const id = deleteTarget.id;
        setBusyId(id);
        try {
            await adminApi.suppliers.remove(id);
            setSuppliers((prev) => prev.filter((s) => s.id !== id));
            setActiveSupplier((prev) => (prev && prev.id === id ? null : prev));
            setToastMessage('Supplier deleted');
            setDeleteTarget(null);
        } catch (err) {
            showError(err, 'Could not delete supplier.');
        } finally {
            setBusyId(null);
        }
    };

    const hasDependencies = (s: Supplier) =>
        s.purchases.length > 0 || s.products.length > 0;

    const addProductsToSupplier = async (
        supplierId: number,
        items: AdminSupplierProductInput[],
    ) => {
        if (items.length === 0) return;
        setBusyId(supplierId);
        try {
            const updated = await adminApi.suppliers.addProducts(supplierId, items);
            replaceSupplier(updated);
            setToastMessage(
                `${items.length} product${items.length > 1 ? 's' : ''} linked`,
            );
        } catch (err) {
            showError(err, 'Could not link products.');
            throw err;
        } finally {
            setBusyId(null);
        }
    };

    const removeProductFromSupplier = async (supplierId: number, productRelId: number) => {
        setBusyId(supplierId);
        try {
            const updated = await adminApi.suppliers.removeProduct(supplierId, productRelId);
            replaceSupplier(updated);
            setToastMessage('Product unlinked');
        } catch (err) {
            showError(err, 'Could not unlink product.');
        } finally {
            setBusyId(null);
        }
    };

    /* ─────────────────────────────────────────────────────────── */
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
                        <div className="flex items-center gap-2 text-[13px] text-slate-500 mb-0.5">
                            <span>Inventory</span>
                            <ChevronRight className="w-3 h-3" />
                            <span className="text-slate-900 font-medium">Suppliers</span>
                        </div>
                        <h1 className="text-[15px] font-semibold text-slate-900">Suppliers</h1>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                            Manage your product suppliers, contacts, supplied products, and purchasing information.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setToastMessage('Suppliers exported as CSV')}
                            className="hidden sm:inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] transition"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>Export</span>
                        </button>
                        <button
                            onClick={() => { setEditingSupplier(null); setIsFormOpen(true); }}
                            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Supplier</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

                {/* SUMMARY CARDS */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[
                        { label: 'Total Suppliers', value: totalSuppliers, icon: Building2, color: 'bg-blue-50 text-blue-950', filter: null as SupplierStatus | null },
                        { label: 'Active', value: activeCount, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700', filter: 'Active' as SupplierStatus },
                        { label: 'Inactive', value: inactiveCount, icon: XCircle, color: 'bg-slate-100 text-slate-600', filter: 'Inactive' as SupplierStatus },
                        { label: 'Products Supplied', value: totalProductsSupplied, icon: Package, color: 'bg-indigo-50 text-indigo-700', filter: null },
                        { label: 'Outstanding', value: formatKES(totalOutstanding), icon: CreditCard, color: 'bg-amber-50 text-amber-700', filter: null },
                    ].map((card, idx) => {
                        const isFilter = card.filter !== null;
                        const active = isFilter && statusFilter === card.filter;
                        return (
                            <button
                                key={idx}
                                onClick={() => isFilter && setStatusFilter(active ? null : card.filter)}
                                disabled={!isFilter}
                                className={`text-left bg-white border rounded-sm p-2 flex items-center justify-between gap-2 transition ${active ? 'border-blue-950 ring-1 ring-blue-950' : 'border-slate-200'
                                    } ${isFilter ? 'hover:border-slate-300 cursor-pointer' : 'cursor-default'}`}
                            >
                                <div className="min-w-0">
                                    <p className="text-[13px] font-medium text-slate-500 truncate">{card.label}</p>
                                    <p className="text-[15px] font-bold text-slate-900 mt-0.5 truncate">{card.value}</p>
                                </div>
                                <span className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 ${card.color}`}>
                                    <card.icon className="w-4 h-4" />
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
                            placeholder="Search suppliers by name, company, email, or phone…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <FilterDropdown
                            label="Status"
                            value={statusFilter}
                            options={['Active', 'Inactive']}
                            onChange={(v) => setStatusFilter(v as SupplierStatus | null)}
                        />
                        <FilterDropdown
                            label="Location"
                            value={locationFilter}
                            options={locations}
                            onChange={setLocationFilter}
                        />
                        <SortDropdown sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
                        {hasFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-[13px] text-red-600 hover:underline font-medium px-2 py-2"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* ERROR BANNER */}
                {loadError && (
                    <div className="bg-red-50 border border-red-100 text-red-700 rounded-sm px-3 py-2 flex items-start gap-2 text-[13px]">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{loadError}</span>
                    </div>
                )}

                {/* SUPPLIERS TABLE / EMPTY STATE / LOADING */}
                {isLoading ? (
                    <div className="bg-white border border-slate-200 rounded-sm p-12 text-center">
                        <Loader2 className="w-5 h-5 mx-auto text-slate-300 animate-spin" />
                        <p className="text-[13px] text-slate-500 mt-2">Loading suppliers…</p>
                    </div>
                ) : suppliers.length === 0 ? (
                    <EmptyState onAdd={() => setIsFormOpen(true)} />
                ) : (
                    <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-[13px]">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                                        <th className="py-2 px-3 font-medium">Supplier</th>
                                        <th className="py-2 px-3 font-medium">Contact</th>
                                        <th className="py-2 px-3 font-medium">Location</th>
                                        <th className="py-2 px-3 font-medium text-center">Products</th>
                                        <th className="py-2 px-3 font-medium text-right">Total Purchases</th>
                                        <th className="py-2 px-3 font-medium">Last Purchase</th>
                                        <th className="py-2 px-3 font-medium">Status</th>
                                        <th className="py-2 px-3 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paged.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center text-slate-400 text-[13px]">
                                                No suppliers match your filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        paged.map((s) => {
                                            const totalPurchases = s.purchases.reduce((a, p) => a + Number(p.totalAmount || 0), 0);
                                            const lastPurchase = s.purchases[0];
                                            const isBusy = busyId === s.id;
                                            return (
                                                <tr
                                                    key={s.id}
                                                    className={`hover:bg-slate-50 transition-colors ${isBusy ? 'opacity-60' : 'cursor-pointer'}`}
                                                    onClick={() => !isBusy && setActiveSupplier(s)}
                                                >
                                                    <td className="py-2 px-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0 font-semibold text-[13px]">
                                                                {s.company.slice(0, 2).toUpperCase()}
                                                            </span>
                                                            <div className="min-w-0">
                                                                <p className="font-medium text-slate-900 truncate max-w-[220px]">{s.company}</p>
                                                                <p className="text-[13px] text-slate-500 truncate">{s.name} · {s.type}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <div className="flex items-center gap-1 text-[13px] text-slate-600">
                                                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                                            <span className="truncate max-w-[160px]">{s.email}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 text-[13px] text-slate-500">
                                                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                                            <span>{s.phone}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-3 text-slate-600">
                                                        <span className="inline-flex items-center gap-1">
                                                            <MapPin className="w-3 h-3 text-slate-400" />
                                                            {s.city}, {s.country}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 text-center">
                                                        <span className="bg-slate-100 px-2 py-0.5 rounded-sm font-medium text-slate-800">
                                                            {s.products.length}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                                                        {totalPurchases > 0 ? formatKES(totalPurchases) : '—'}
                                                    </td>
                                                    <td className="py-2 px-3 text-slate-500 font-mono text-[13px]">
                                                        {lastPurchase ? lastPurchase.date : '—'}
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${STATUS_STYLES[s.status]}`}>
                                                            {s.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                onClick={() => setActiveSupplier(s)}
                                                                disabled={isBusy}
                                                                title="View"
                                                                className="w-8 h-8 rounded-sm hover:bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition disabled:opacity-40"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => { setEditingSupplier(s); setIsFormOpen(true); }}
                                                                disabled={isBusy}
                                                                title="Edit"
                                                                className="w-8 h-8 rounded-sm hover:bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition disabled:opacity-40"
                                                            >
                                                                <Edit className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => toggleStatus(s.id)}
                                                                disabled={isBusy}
                                                                title={s.status === 'Active' ? 'Deactivate' : 'Activate'}
                                                                className="w-8 h-8 rounded-sm hover:bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition disabled:opacity-40"
                                                            >
                                                                {isBusy ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <Power className="w-3.5 h-3.5" />
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteTarget(s)}
                                                                disabled={isBusy}
                                                                title="Delete"
                                                                className="w-8 h-8 rounded-sm hover:bg-red-50 text-slate-500 hover:text-red-600 flex items-center justify-center transition disabled:opacity-40"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* PAGINATION */}
                        {filtered.length > pageSize && (
                            <div className="px-3 py-2 border-t border-slate-200 flex items-center justify-between text-[13px]">
                                <span className="text-slate-500">
                                    Showing <span className="font-medium text-slate-900">{(page - 1) * pageSize + 1}</span>–
                                    <span className="font-medium text-slate-900">{Math.min(page * pageSize, filtered.length)}</span> of{' '}
                                    <span className="font-medium text-slate-900">{filtered.length}</span>
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="w-8 h-8 rounded-sm border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter((p) => Math.abs(p - page) < 2 || p === 1 || p === totalPages)
                                        .map((p, i, arr) => (
                                            <React.Fragment key={p}>
                                                {i > 0 && arr[i - 1] !== p - 1 && (
                                                    <span className="px-1 text-slate-400">…</span>
                                                )}
                                                <button
                                                    onClick={() => setPage(p)}
                                                    className={`w-8 h-8 rounded-sm text-[13px] font-medium ${p === page
                                                        ? 'bg-blue-950 text-white'
                                                        : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                                                        }`}
                                                >
                                                    {p}
                                                </button>
                                            </React.Fragment>
                                        ))}
                                    <button
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        className="w-8 h-8 rounded-sm border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* ADD/EDIT FORM MODAL */}
            {isFormOpen && (
                <SupplierFormModal
                    supplier={editingSupplier}
                    onClose={() => { setIsFormOpen(false); setEditingSupplier(null); }}
                    onSave={handleSaveSupplier}
                />
            )}

            {/* DETAILS DRAWER */}
            {activeSupplier && (
                <SupplierDrawer
                    supplier={activeSupplier}
                    busy={busyId === activeSupplier.id}
                    onClose={() => setActiveSupplier(null)}
                    onEdit={() => { setEditingSupplier(activeSupplier); setActiveSupplier(null); setIsFormOpen(true); }}
                    onAddProducts={(items) => addProductsToSupplier(activeSupplier.id, items)}
                    onRemoveProduct={(relId) => removeProductFromSupplier(activeSupplier.id, relId)}
                    onToggleStatus={() => { toggleStatus(activeSupplier.id); }}
                />
            )}

            {/* DELETE PROTECTION DIALOG */}
            {deleteTarget && (
                <DeleteSupplierDialog
                    supplier={deleteTarget}
                    hasDependencies={hasDependencies(deleteTarget)}
                    onCancel={() => setDeleteTarget(null)}
                    onDeactivate={async () => { await toggleStatus(deleteTarget.id); setDeleteTarget(null); }}
                    onConfirmDelete={confirmDelete}
                />
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   SUPPLIER FORM MODAL (Add / Edit)
───────────────────────────────────────────────────────────── */
function SupplierFormModal({
    supplier,
    onClose,
    onSave,
}: {
    supplier: Supplier | null;
    onClose: () => void;
    onSave: (data: AdminSupplierWrite, id?: number) => Promise<void>;
}) {
    const editing = Boolean(supplier);
    const [name, setName] = useState(supplier?.name || '');
    const [company, setCompany] = useState(supplier?.company || '');
    const [type, setType] = useState<SupplierType>(supplier?.type || 'Distributor');
    const [phone, setPhone] = useState(supplier?.phone || '');
    const [email, setEmail] = useState(supplier?.email || '');
    const [website, setWebsite] = useState(supplier?.website || '');

    const [country, setCountry] = useState(supplier?.country || 'Kenya');
    const [county, setCounty] = useState(supplier?.county || 'Nairobi');
    const [city, setCity] = useState(supplier?.city || 'Nairobi');
    const [address, setAddress] = useState(supplier?.address || '');

    const [taxPin, setTaxPin] = useState(supplier?.taxPin || '');
    const [regNumber, setRegNumber] = useState(supplier?.regNumber || '');
    const [paymentTerms, setPaymentTerms] = useState(supplier?.paymentTerms || 'Net 30');
    const [paymentMethod, setPaymentMethod] = useState(supplier?.paymentMethod || 'Bank Transfer');

    const [notes, setNotes] = useState(supplier?.notes || '');
    const [status, setStatus] = useState<SupplierStatus>(supplier?.status || 'Active');

    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;

        if (!name.trim() || !company.trim()) {
            setError('Supplier name and company name are required.');
            return;
        }
        if (!phone.trim() && !email.trim()) {
            setError('Provide at least one contact method (phone or email).');
            return;
        }

        setError(null);
        setSaving(true);
        try {
            await onSave(
                {
                    name: name.trim(),
                    company: company.trim(),
                    type,
                    phone: phone.trim(),
                    email: email.trim().toLowerCase(),
                    website: website.trim() || undefined,
                    country,
                    county,
                    city: city.trim(),
                    address: address.trim(),
                    taxPin: taxPin.trim(),
                    regNumber: regNumber.trim(),
                    paymentTerms,
                    paymentMethod,
                    notes: notes.trim(),
                    status,
                },
                supplier?.id,
            );
        } catch (err) {
            setError(
                err instanceof ApiError
                    ? err.message || 'Could not save supplier.'
                    : 'Could not save supplier.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
            onClick={() => !saving && onClose()}
        >
            <div
                className="bg-white border border-slate-200 rounded-sm max-w-2xl w-full max-h-[92vh] flex flex-col shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 shrink-0">
                    <div>
                        <h2 className="text-[15px] font-semibold text-slate-900">
                            {editing ? 'Edit supplier' : 'Add supplier'}
                        </h2>
                        <p className="text-[13px] text-slate-500">
                            {editing ? 'Update supplier information' : 'Create a new supplier record'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 disabled:opacity-40"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={submit} className="flex-1 overflow-y-auto p-3 space-y-4 text-[13px]">
                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-700 rounded-sm px-3 py-2 flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <Section title="Basic information">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Field label="Supplier name *">
                                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Sarah Mwangi" />
                            </Field>
                            <Field label="Company name *">
                                <input value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} placeholder="e.g. Lenovo East Africa" />
                            </Field>
                            <Field label="Supplier type">
                                <select value={type} onChange={(e) => setType(e.target.value as SupplierType)} className={inputCls}>
                                    {SUPPLIER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </Field>
                            <Field label="Phone">
                                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+254 7XX XXX XXX" />
                            </Field>
                            <Field label="Email">
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="supplier@example.com" />
                            </Field>
                            <Field label="Website">
                                <input value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} placeholder="https://" />
                            </Field>
                        </div>
                    </Section>

                    <Section title="Address">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Field label="Country">
                                <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls}>
                                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </Field>
                            <Field label="County / Region">
                                <select value={county} onChange={(e) => setCounty(e.target.value)} className={inputCls}>
                                    {COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </Field>
                            <Field label="City / Town">
                                <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} placeholder="e.g. Nairobi" />
                            </Field>
                        </div>
                        <Field label="Physical address">
                            <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} placeholder="Street, building, floor…" />
                        </Field>
                    </Section>

                    <Section title="Business information">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Field label="Tax / KRA PIN">
                                <input value={taxPin} onChange={(e) => setTaxPin(e.target.value)} className={inputCls} placeholder="e.g. P051234567X" />
                            </Field>
                            <Field label="Business registration no.">
                                <input value={regNumber} onChange={(e) => setRegNumber(e.target.value)} className={inputCls} placeholder="e.g. PVT-2018-44521" />
                            </Field>
                            <Field label="Payment terms">
                                <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={inputCls}>
                                    {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </Field>
                            <Field label="Preferred payment method">
                                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputCls}>
                                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </Field>
                        </div>
                    </Section>

                    <Section title="Additional">
                        <Field label="Notes">
                            <textarea
                                rows={3}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className={`${inputCls} resize-none`}
                                placeholder="Any additional information about this supplier…"
                            />
                        </Field>
                        <Field label="Status">
                            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-0.5 rounded-sm">
                                {(['Active', 'Inactive'] as SupplierStatus[]).map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setStatus(s)}
                                        className={`py-2 rounded-sm text-[13px] font-medium transition ${status === s
                                            ? s === 'Active'
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-slate-700 text-white'
                                            : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </Field>
                    </Section>
                </form>

                <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={saving}
                        className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5 disabled:opacity-60"
                    >
                        {saving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Check className="w-3.5 h-3.5" />
                        )}
                        {editing ? 'Save changes' : 'Create supplier'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const inputCls =
    'w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <h3 className="text-[13px] font-semibold text-slate-700 uppercase tracking-wide">{title}</h3>
                <div className="flex-1 h-px bg-slate-100" />
            </div>
            <div className="space-y-2">{children}</div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="block font-medium text-slate-700 mb-1">{label}</span>
            {children}
        </label>
    );
}

/* ─────────────────────────────────────────────────────────────
   SUPPLIER DETAILS DRAWER
───────────────────────────────────────────────────────────── */
function SupplierDrawer({
    supplier,
    busy,
    onClose,
    onEdit,
    onAddProducts,
    onRemoveProduct,
    onToggleStatus,
}: {
    supplier: Supplier;
    busy: boolean;
    onClose: () => void;
    onEdit: () => void;
    onAddProducts: (items: AdminSupplierProductInput[]) => Promise<void>;
    onRemoveProduct: (relId: number) => void;
    onToggleStatus: () => void;
}) {
    const [tab, setTab] = useState<DrawerTab>('overview');
    const [isAddProductsOpen, setIsAddProductsOpen] = useState(false);

    const totalPurchases = supplier.purchases.reduce((a, p) => a + Number(p.totalAmount || 0), 0);
    const outstanding = supplier.purchases
        .filter((p) => p.paymentStatus !== 'Paid')
        .reduce((a, p) => a + Number(p.totalAmount || 0), 0);

    const tabs: { id: DrawerTab; label: string; icon: any; count?: number }[] = [
        { id: 'overview', label: 'Overview', icon: Building2 },
        { id: 'products', label: 'Products', icon: Package, count: supplier.products.length },
        { id: 'purchases', label: 'Purchases', icon: Receipt, count: supplier.purchases.length },
        { id: 'activity', label: 'Activity', icon: Activity, count: supplier.activity.length },
    ];

    return (
        <>
            <div
                className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end"
                onClick={() => !busy && onClose()}
            >
                <div
                    className="bg-white border-l border-slate-200 w-full max-w-2xl h-full flex flex-col shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Drawer header */}
                    <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="w-9 h-9 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0 font-semibold text-[13px]">
                                {supplier.company.slice(0, 2).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-[15px] font-semibold text-slate-900 truncate">{supplier.company}</h2>
                                    <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border text-[13px] ${STATUS_STYLES[supplier.status]}`}>
                                        {supplier.status}
                                    </span>
                                </div>
                                <p className="text-[13px] text-slate-500 truncate">
                                    {supplier.name} · {supplier.type}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                onClick={onEdit}
                                disabled={busy}
                                title="Edit"
                                className="h-8 px-2 rounded-sm hover:bg-white border border-slate-200 text-slate-700 flex items-center gap-1 text-[13px] font-medium disabled:opacity-40"
                            >
                                <Edit className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Edit</span>
                            </button>
                            <button
                                onClick={onClose}
                                disabled={busy}
                                className="h-8 w-8 rounded-sm hover:bg-white border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-0.5 border-b border-slate-200 bg-white px-3 overflow-x-auto shrink-0">
                        {tabs.map((t) => {
                            const Icon = t.icon;
                            const isActive = tab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setTab(t.id)}
                                    className={`flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium border-b-2 transition whitespace-nowrap ${isActive
                                        ? 'border-blue-950 text-blue-950'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                        }`}
                                >
                                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-950' : 'text-slate-400'}`} />
                                    <span>{t.label}</span>
                                    {t.count !== undefined && (
                                        <span className={`px-1.5 rounded-sm text-[13px] font-medium ${isActive ? 'bg-blue-50 text-blue-950' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {t.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Drawer body */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
                        {tab === 'overview' && (
                            <>
                                <div className="grid grid-cols-3 gap-2">
                                    <MiniStat label="Total purchases" value={formatKES(totalPurchases)} icon={CreditCard} tint="bg-blue-50 text-blue-950" />
                                    <MiniStat label="Outstanding" value={outstanding > 0 ? formatKES(outstanding) : '—'} icon={AlertTriangle} tint="bg-amber-50 text-amber-700" />
                                    <MiniStat label="Products supplied" value={String(supplier.products.length)} icon={Package} tint="bg-indigo-50 text-indigo-700" />
                                </div>

                                <InfoSection title="Contact information">
                                    <InfoRow icon={User} label="Contact person" value={supplier.name} />
                                    <InfoRow icon={Phone} label="Phone" value={supplier.phone || '—'} />
                                    <InfoRow icon={Mail} label="Email" value={supplier.email || '—'} />
                                    {supplier.website && (
                                        <InfoRow icon={Globe} label="Website" value={
                                            <a href={supplier.website} target="_blank" rel="noreferrer" className="text-blue-950 hover:underline">
                                                {supplier.website.replace(/^https?:\/\//, '')}
                                            </a>
                                        } />
                                    )}
                                </InfoSection>

                                <InfoSection title="Address">
                                    <InfoRow icon={MapPin} label="Location" value={`${supplier.city}, ${supplier.county}, ${supplier.country}`} />
                                    <InfoRow icon={MapPin} label="Physical" value={supplier.address || '—'} />
                                </InfoSection>

                                <InfoSection title="Business information">
                                    <InfoRow icon={Hash} label="Tax / KRA PIN" value={supplier.taxPin || '—'} />
                                    <InfoRow icon={FileText} label="Reg. number" value={supplier.regNumber || '—'} />
                                    <InfoRow icon={Calendar} label="Payment terms" value={supplier.paymentTerms} />
                                    <InfoRow icon={CreditCard} label="Payment method" value={supplier.paymentMethod} />
                                    <InfoRow icon={Clock} label="Date added" value={supplier.createdAt.slice(0, 10)} />
                                </InfoSection>

                                {supplier.notes && (
                                    <InfoSection title="Notes">
                                        <p className="text-slate-600 bg-slate-50 border border-slate-200 rounded-sm p-2">
                                            {supplier.notes}
                                        </p>
                                    </InfoSection>
                                )}
                            </>
                        )}

                        {tab === 'products' && (
                            <>
                                <div className="flex items-center justify-between">
                                    <p className="font-medium text-slate-700">
                                        {supplier.products.length} product{supplier.products.length !== 1 ? 's' : ''} supplied
                                    </p>
                                    <button
                                        onClick={() => setIsAddProductsOpen(true)}
                                        disabled={busy}
                                        className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition disabled:opacity-40"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Add products
                                    </button>
                                </div>

                                {supplier.products.length === 0 ? (
                                    <div className="border-2 border-dashed border-slate-200 rounded-sm p-8 text-center">
                                        <Package className="w-8 h-8 mx-auto text-slate-300" />
                                        <p className="text-[13px] font-medium text-slate-700 mt-2">No products linked</p>
                                        <p className="text-[13px] text-slate-500 mt-0.5">
                                            Add products from your catalogue to track what this supplier provides.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="border border-slate-200 rounded-sm overflow-hidden">
                                        <table className="w-full text-left text-[13px]">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                                                    <th className="py-2 px-3 font-medium">Product</th>
                                                    <th className="py-2 px-3 font-medium text-center">Stock</th>
                                                    <th className="py-2 px-3 font-medium text-right">Cost</th>
                                                    <th className="py-2 px-3 font-medium text-center">Lead</th>
                                                    <th className="py-2 px-3 font-medium">Last purchase</th>
                                                    <th className="py-2 px-3 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {supplier.products.map((sp) => (
                                                    <tr key={sp.id} className="hover:bg-slate-50">
                                                        <td className="py-2 px-3">
                                                            <div className="flex items-center gap-2">
                                                                <img src={sp.image || '/placeholder.png'} alt={sp.name} className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0" />
                                                                <div className="min-w-0">
                                                                    <p className="font-medium text-slate-900 truncate max-w-[200px]">{sp.name}</p>
                                                                    <p className="font-mono text-[13px] text-slate-400">{sp.sku || sp.supplierSku || '—'}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-2 px-3 text-center font-medium text-slate-900">{sp.currentStock}</td>
                                                        <td className="py-2 px-3 text-right font-mono text-slate-700">{formatKES(Number(sp.costPrice))}</td>
                                                        <td className="py-2 px-3 text-center text-slate-600 font-mono">{sp.leadTimeDays}d</td>
                                                        <td className="py-2 px-3">
                                                            <p className="font-mono text-slate-700">{formatKES(Number(sp.lastPurchasePrice))}</p>
                                                            <p className="text-[13px] text-slate-400">{sp.lastPurchaseDate || '—'}</p>
                                                        </td>
                                                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => onRemoveProduct(sp.id)}
                                                                disabled={busy}
                                                                title="Unlink"
                                                                className="w-8 h-8 rounded-sm hover:bg-red-50 text-slate-400 hover:text-red-600 flex items-center justify-center transition disabled:opacity-40"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}

                        {tab === 'purchases' && (
                            <>
                                {supplier.purchases.length === 0 ? (
                                    <div className="border-2 border-dashed border-slate-200 rounded-sm p-8 text-center">
                                        <Receipt className="w-8 h-8 mx-auto text-slate-300" />
                                        <p className="text-[13px] font-medium text-slate-700 mt-2">No purchase history</p>
                                        <p className="text-[13px] text-slate-500 mt-0.5">
                                            Purchases recorded against this supplier will appear here.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="border border-slate-200 rounded-sm overflow-hidden">
                                        <table className="w-full text-left text-[13px]">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                                                    <th className="py-2 px-3 font-medium">Order #</th>
                                                    <th className="py-2 px-3 font-medium">Date</th>
                                                    <th className="py-2 px-3 font-medium text-center">Items</th>
                                                    <th className="py-2 px-3 font-medium text-center">Qty</th>
                                                    <th className="py-2 px-3 font-medium text-right">Total</th>
                                                    <th className="py-2 px-3 font-medium">Payment</th>
                                                    <th className="py-2 px-3 font-medium">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {supplier.purchases.map((p) => (
                                                    <tr key={p.id} className="hover:bg-slate-50">
                                                        <td className="py-2 px-3 font-mono font-medium text-blue-950">{p.number}</td>
                                                        <td className="py-2 px-3 text-slate-500 font-mono">{p.date}</td>
                                                        <td className="py-2 px-3 text-center text-slate-700">{p.itemsCount}</td>
                                                        <td className="py-2 px-3 text-center text-slate-700">{p.totalQty}</td>
                                                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                                                            {formatKES(Number(p.totalAmount))}
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${PAYMENT_STATUS_STYLES[p.paymentStatus]}`}>
                                                                {p.paymentStatus}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${PURCHASE_STATUS_STYLES[p.status]}`}>
                                                                {p.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}

                        {tab === 'activity' && (
                            <div>
                                {supplier.activity.length === 0 ? (
                                    <p className="text-[13px] text-slate-400 text-center py-8">No activity yet.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {supplier.activity.map((a) => {
                                            const Icon = ACTIVITY_ICON[a.type] || Activity;
                                            return (
                                                <li key={a.id} className="bg-white border border-slate-200 rounded-sm p-2 flex items-start gap-2">
                                                    <span className={`w-7 h-7 rounded-sm flex items-center justify-center shrink-0 ${ACTIVITY_COLOR[a.type]}`}>
                                                        <Icon className="w-3.5 h-3.5" />
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-slate-800">{a.description}</p>
                                                        <div className="flex items-center justify-between text-[13px] text-slate-400 pt-1">
                                                            <span>{a.user}</span>
                                                            <span>{a.date}</span>
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Drawer footer */}
                    <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                        <button
                            onClick={onToggleStatus}
                            disabled={busy}
                            className={`inline-flex items-center gap-1.5 font-medium px-3 py-2 rounded-sm text-[13px] border transition disabled:opacity-40 ${supplier.status === 'Active'
                                ? 'bg-white border-slate-200 hover:bg-red-50 hover:border-red-200 text-red-600'
                                : 'bg-white border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 text-emerald-700'
                                }`}
                        >
                            {busy ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Power className="w-3.5 h-3.5" />
                            )}
                            {supplier.status === 'Active' ? 'Deactivate supplier' : 'Activate supplier'}
                        </button>
                        <span className="text-[13px] text-slate-500 font-mono">
                            ID: {supplier.id}
                        </span>
                    </div>
                </div>
            </div>

            {/* Add Products sub-modal */}
            {isAddProductsOpen && (
                <AddProductsModal
                    existingProductIds={supplier.products.map((p) => p.productId)}
                    onClose={() => setIsAddProductsOpen(false)}
                    onAdd={async (items) => {
                        try {
                            await onAddProducts(items);
                            setIsAddProductsOpen(false);
                        } catch {
                            /* error surfaced by parent toast — keep modal open */
                        }
                    }}
                />
            )}
        </>
    );
}

/* ─────────────────────────────────────────────────────────────
   INFO ROW / SECTION / MINI STAT
───────────────────────────────────────────────────────────── */
function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="font-medium text-slate-700 mb-1.5">{title}</p>
            <div className="bg-white border border-slate-200 rounded-sm divide-y divide-slate-100">
                {children}
            </div>
        </div>
    );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2 px-3 py-2">
            <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-500 w-32 shrink-0">{label}</span>
            <span className="text-slate-900 font-medium min-w-0 truncate">{value}</span>
        </div>
    );
}

function MiniStat({ label, value, icon: Icon, tint }: { label: string; value: string; icon: any; tint: string }) {
    return (
        <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
                <p className="text-[13px] text-slate-500 truncate">{label}</p>
                <p className="text-[13px] font-bold text-slate-900 mt-0.5 truncate">{value}</p>
            </div>
            <span className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${tint}`}>
                <Icon className="w-3.5 h-3.5" />
            </span>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   ADD PRODUCTS MODAL
───────────────────────────────────────────────────────────── */
function AddProductsModal({
    existingProductIds,
    onClose,
    onAdd,
}: {
    existingProductIds: string[];
    onClose: () => void;
    onAdd: (items: AdminSupplierProductInput[]) => Promise<void> | void;
}) {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<Record<string, { costPrice: string; supplierSku: string; minOrderQty: string; leadTimeDays: string }>>({});
    const [submitting, setSubmitting] = useState(false);

    const available = CATALOG_PRODUCTS.filter(
        (p) => !existingProductIds.includes(p.id) &&
            (!query || p.name.toLowerCase().includes(query.toLowerCase()) || p.sku.toLowerCase().includes(query.toLowerCase())),
    );

    const toggle = (id: string) => {
        setSelected((prev) => {
            const next = { ...prev };
            if (next[id]) delete next[id];
            else next[id] = { costPrice: '', supplierSku: '', minOrderQty: '1', leadTimeDays: '14' };
            return next;
        });
    };

    const updateField = (id: string, key: string, value: string) => {
        setSelected((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
    };

    const submit = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const items: AdminSupplierProductInput[] = Object.entries(selected).map(([pid, data]) => {
                const prod = CATALOG_PRODUCTS.find((p) => p.id === pid)!;
                return {
                    productId: prod.id,
                    name: prod.name,
                    sku: prod.sku,
                    image: prod.image,
                    category: prod.category,
                    supplierSku: data.supplierSku || prod.sku,
                    costPrice: parseInt(data.costPrice, 10) || 0,
                    minOrderQty: parseInt(data.minOrderQty, 10) || 1,
                    leadTimeDays: parseInt(data.leadTimeDays, 10) || 14,
                };
            });
            await onAdd(items);
        } finally {
            setSubmitting(false);
        }
    };

    const count = Object.keys(selected).length;

    return (
        <div
            className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
            onClick={() => !submitting && onClose()}
        >
            <div
                className="bg-white border border-slate-200 rounded-sm max-w-3xl w-full max-h-[90vh] flex flex-col shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 shrink-0">
                    <div>
                        <h3 className="text-[15px] font-semibold text-slate-900">Add products to supplier</h3>
                        <p className="text-[13px] text-slate-500">Select products from your catalogue to link to this supplier.</p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 disabled:opacity-40"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-3 py-2 border-b border-slate-200 shrink-0">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search catalogue by name or SKU…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {available.length === 0 ? (
                        <p className="text-[13px] text-slate-400 text-center py-8">
                            No matching products found in your catalogue.
                        </p>
                    ) : (
                        available.map((p) => {
                            const isSelected = Boolean(selected[p.id]);
                            return (
                                <div
                                    key={p.id}
                                    className={`border rounded-sm transition ${isSelected ? 'border-blue-950 bg-blue-50/30' : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    <label className="flex items-center gap-2 p-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggle(p.id)}
                                            disabled={submitting}
                                            className="rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                                        />
                                        <img src={p.image} alt={p.name} className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-slate-900 truncate">{p.name}</p>
                                            <p className="font-mono text-[13px] text-slate-400">{p.sku} · {p.category}</p>
                                        </div>
                                    </label>

                                    {isSelected && (
                                        <div className="border-t border-slate-200 p-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[13px]">
                                            <label>
                                                <span className="block text-slate-500 mb-1">Cost price (KES)</span>
                                                <input
                                                    type="number"
                                                    value={selected[p.id].costPrice}
                                                    onChange={(e) => updateField(p.id, 'costPrice', e.target.value)}
                                                    disabled={submitting}
                                                    className={inputCls}
                                                    placeholder="0"
                                                />
                                            </label>
                                            <label>
                                                <span className="block text-slate-500 mb-1">Supplier SKU</span>
                                                <input
                                                    value={selected[p.id].supplierSku}
                                                    onChange={(e) => updateField(p.id, 'supplierSku', e.target.value)}
                                                    disabled={submitting}
                                                    className={inputCls}
                                                    placeholder={p.sku}
                                                />
                                            </label>
                                            <label>
                                                <span className="block text-slate-500 mb-1">Min. order qty</span>
                                                <input
                                                    type="number"
                                                    value={selected[p.id].minOrderQty}
                                                    onChange={(e) => updateField(p.id, 'minOrderQty', e.target.value)}
                                                    disabled={submitting}
                                                    className={inputCls}
                                                />
                                            </label>
                                            <label>
                                                <span className="block text-slate-500 mb-1">Lead time (days)</span>
                                                <input
                                                    type="number"
                                                    value={selected[p.id].leadTimeDays}
                                                    onChange={(e) => updateField(p.id, 'leadTimeDays', e.target.value)}
                                                    disabled={submitting}
                                                    className={inputCls}
                                                />
                                            </label>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="px-3 py-2 border-t border-slate-200 flex items-center justify-between shrink-0">
                    <span className="text-[13px] text-slate-500">
                        {count > 0 ? `${count} product${count > 1 ? 's' : ''} selected` : 'Select products to link'}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            disabled={submitting}
                            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={submit}
                            disabled={count === 0 || submitting}
                            className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                        >
                            {submitting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Plus className="w-3.5 h-3.5" />
                            )}
                            Add {count > 0 ? `${count}` : ''} product{count > 1 ? 's' : ''}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   DELETE PROTECTION DIALOG
───────────────────────────────────────────────────────────── */
function DeleteSupplierDialog({
    supplier,
    hasDependencies,
    onCancel,
    onDeactivate,
    onConfirmDelete,
}: {
    supplier: Supplier;
    hasDependencies: boolean;
    onCancel: () => void;
    onDeactivate: () => void;
    onConfirmDelete: () => void;
}) {
    return (
        <div
            className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
            onClick={onCancel}
        >
            <div
                className="bg-white border border-slate-200 rounded-sm max-w-md w-full shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-3 space-y-3">
                    <div className="flex items-start gap-2">
                        <span className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 ${hasDependencies ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
                            }`}>
                            <AlertTriangle className="w-4 h-4" />
                        </span>
                        <div>
                            <h3 className="text-[15px] font-semibold text-slate-900">
                                {hasDependencies ? 'Cannot permanently delete' : 'Delete supplier?'}
                            </h3>
                            <p className="text-[13px] text-slate-500 mt-0.5">
                                {hasDependencies
                                    ? `${supplier.company} has ${supplier.purchases.length} purchase record${supplier.purchases.length !== 1 ? 's' : ''} and ${supplier.products.length} product link${supplier.products.length !== 1 ? 's' : ''}. To preserve your records, deactivate this supplier instead.`
                                    : `${supplier.company} has no purchase history or linked products. This action cannot be undone.`}
                            </p>
                        </div>
                    </div>

                    {hasDependencies && (
                        <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-1 text-[13px]">
                            <p className="text-slate-600">
                                <span className="font-medium text-slate-900">What deactivating does:</span>
                            </p>
                            <ul className="space-y-0.5 text-slate-600 pl-3 list-disc">
                                <li>Hides the supplier from active lists</li>
                                <li>Preserves all purchase records and product links</li>
                                <li>Can be reactivated at any time</li>
                            </ul>
                        </div>
                    )}
                </div>

                <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                    >
                        Cancel
                    </button>
                    {hasDependencies ? (
                        <button
                            onClick={onDeactivate}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
                        >
                            <Power className="w-3.5 h-3.5" />
                            Deactivate supplier
                        </button>
                    ) : (
                        <button
                            onClick={onConfirmDelete}
                            className="bg-red-600 hover:bg-red-700 text-white font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete supplier
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   EMPTY STATE
───────────────────────────────────────────────────────────── */
function EmptyState({ onAdd }: { onAdd: () => void }) {
    return (
        <div className="bg-white border border-slate-200 rounded-sm p-8 sm:p-16 text-center">
            <span className="w-12 h-12 rounded-sm bg-blue-50 text-blue-950 inline-flex items-center justify-center">
                <Building2 className="w-6 h-6" />
            </span>
            <h2 className="text-[15px] font-semibold text-slate-900 mt-3">No suppliers yet</h2>
            <p className="text-[13px] text-slate-500 mt-1 max-w-md mx-auto">
                Add your first supplier to start tracking who provides products to your shop.
            </p>
            <button
                onClick={onAdd}
                className="mt-4 inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
                <Plus className="w-3.5 h-3.5" />
                Add Supplier
            </button>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   SORT DROPDOWN
───────────────────────────────────────────────────────────── */
function SortDropdown({
    sortKey, sortAsc, onToggle,
}: {
    sortKey: SortKey; sortAsc: boolean; onToggle: (k: SortKey) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        if (open) document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    const labels: Record<SortKey, string> = {
        name: 'Name',
        purchases: 'Total purchases',
        lastPurchase: 'Last purchase',
    };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-sm px-3 py-2 text-[13px] font-medium transition whitespace-nowrap"
            >
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span>{labels[sortKey]}</span>
                <span className="text-slate-400">{sortAsc ? '↑' : '↓'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute top-full mt-1 right-0 w-56 rounded-sm border border-slate-200 bg-white shadow-lg z-50 p-1">
                    {(['name', 'purchases', 'lastPurchase'] as SortKey[]).map((k) => (
                        <button
                            key={k}
                            onClick={() => { onToggle(k); setOpen(false); }}
                            className={`w-full text-left px-2 py-2 rounded-sm text-[13px] flex items-center justify-between ${sortKey === k ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
                                }`}
                        >
                            <span>{labels[k]}</span>
                            {sortKey === k && <span className="text-slate-400">{sortAsc ? '↑' : '↓'}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   FILTER DROPDOWN
───────────────────────────────────────────────────────────── */
function FilterDropdown({
    label, value, options, onChange,
}: {
    label: string; value: string | null; options: string[]; onChange: (v: string | null) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
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
                className={`flex items-center gap-1.5 border rounded-sm px-3 py-2 text-[13px] font-medium transition whitespace-nowrap ${isActive ? 'bg-blue-50 border-blue-950 text-blue-950' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
            >
                {value ?? label}
                <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute top-full mt-1 left-0 w-56 rounded-sm border border-slate-200 bg-white shadow-lg z-50 p-1 max-h-72 overflow-y-auto">
                    <button
                        onClick={() => { onChange(null); setOpen(false); }}
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
                                onClick={() => { onChange(opt); setOpen(false); }}
                                className={`w-full text-left px-2 py-2 rounded-sm text-[13px] flex items-center justify-between ${selected ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
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