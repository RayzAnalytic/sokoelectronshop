'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Users,
  Search,
  Download,
  Plus,
  Calendar,
  ShoppingBag,
  DollarSign,
  ArrowLeft,
  Check,
  X,
  MoreVertical,
  ShieldAlert,
  Mail,
  MapPin,
  Edit3,
  Trash2,
  Send,
  ChevronDown,
  Heart,
  ShoppingCart,
  Star,
  Bell,
  Tag,
  TrendingUp,
  Phone,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { adminApi } from '@/lib/admin-api';
import type {
  AdminCustomerDetail,
  AdminCustomerListResponse,
  AdminCustomerSegment,
  AdminMarketingConsent,
  AdminCustomerFilters,
} from '@/lib/admin-types';

// ═════════════════════════════════════════════════════════════════════════════
// WHATSAPP ICON
//
// Official WhatsApp glyph. Rendered inline so it inherits `currentColor`
// and can be sized via the `className` prop just like a Lucide icon.
// Used in the header button and in every channel badge where a
// communication log entry has `channel === 'WhatsApp'`.
// ═════════════════════════════════════════════════════════════════════════════
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═════════════════════════════════════════════════════════════════════════════
const SEGMENTS: AdminCustomerSegment[] = [
  'VIP', 'Loyal', 'New', 'At Risk', 'Churned', 'Regular',
];
const ORDER_COUNT_OPTIONS = ['1', '2-5', '5+'];
const SPENT_RANGE_OPTIONS = ['100k+', '50k-100k', '<50k'];
const SPENT_LABELS: Record<string, string> = {
  '100k+': 'KES 100k+ (VIP)',
  '50k-100k': 'KES 50k–100k',
  '<50k': 'Under KES 50k',
};

// ═════════════════════════════════════════════════════════════════════════════
// PAGE — switches between list and detail
// ═════════════════════════════════════════════════════════════════════════════
export default function CustomersPage() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">
      {selectedCustomerId ? (
        <CustomerDetailPage
          customerId={selectedCustomerId}
          onBack={() => setSelectedCustomerId(null)}
        />
      ) : (
        <CustomersListPage onSelectCustomer={setSelectedCustomerId} />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. LIST VIEW
// ═════════════════════════════════════════════════════════════════════════════
function CustomersListPage({
  onSelectCustomer,
}: {
  onSelectCustomer: (id: string) => void;
}) {
  const [data, setData] = useState<AdminCustomerListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<AdminCustomerSegment | null>(null);
  const [orderCountFilter, setOrderCountFilter] = useState<string | null>(null);
  const [spentRangeFilter, setSpentRangeFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: AdminCustomerFilters = {};
      if (searchQuery.trim()) filters.search = searchQuery.trim();
      if (segmentFilter) filters.segment = segmentFilter;
      if (orderCountFilter) filters.orders = orderCountFilter as '1' | '2-5' | '5+';
      if (spentRangeFilter) filters.spent = spentRangeFilter as '100k+' | '50k-100k' | '<50k';

      const res = await adminApi.customers.list(filters);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, segmentFilter, orderCountFilter, spentRangeFilter]);

  useEffect(() => {
    const t = setTimeout(fetchCustomers, 250);
    return () => clearTimeout(t);
  }, [fetchCustomers]);

  const customers = data?.results ?? [];
  const stats = data?.stats;
  const segmentCounts = data?.segment_counts ?? {};

  const totalCustomers = stats?.total_customers ?? 0;
  const newThisMonth = stats?.new_this_month ?? 0;
  const repeatRate = stats?.repeat_rate ?? 0;
  const avgOrderValue = stats?.avg_order_value ?? 0;

  const allSelected =
    customers.length > 0 && selectedIds.length === customers.length;
  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? [] : customers.map((c) => c.id));
  const toggleRow = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );

  const activeFilterCount =
    (segmentFilter ? 1 : 0) +
    (orderCountFilter ? 1 : 0) +
    (spentRangeFilter ? 1 : 0);

  const clearFilters = () => {
    setSearchQuery('');
    setSegmentFilter(null);
    setOrderCountFilter(null);
    setSpentRangeFilter(null);
  };

  const handleExport = async () => {
    setToastMessage('Exporting customers CSV…');
    try {
      const filters: AdminCustomerFilters = {};
      if (searchQuery.trim()) filters.search = searchQuery.trim();
      if (segmentFilter) filters.segment = segmentFilter;
      if (orderCountFilter) filters.orders = orderCountFilter as '1' | '2-5' | '5+';
      if (spentRangeFilter) filters.spent = spentRangeFilter as '100k+' | '50k-100k' | '<50k';

      const { csv } = await adminApi.customers.export(filters);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setToastMessage(`Exported ${customers.length} customers`);
    } catch {
      setToastMessage('Export failed');
    }
  };

  const segmentBadge = (s: AdminCustomerSegment) =>
    s === 'VIP'
      ? 'bg-amber-50 text-amber-800 border-amber-100'
      : s === 'Loyal'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
        : s === 'New'
          ? 'bg-blue-50 text-blue-950 border-blue-100'
          : s === 'At Risk'
            ? 'bg-red-50 text-red-600 border-red-100'
            : s === 'Churned'
              ? 'bg-slate-100 text-slate-600 border-slate-200'
              : 'bg-slate-50 text-slate-700 border-slate-200';

  return (
    <>
      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Customers</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Mini CRM — profiles, segments, and lifetime value
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => setToastMessage('Add customer is not supported yet')}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add customer</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Total customers</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">
                {totalCustomers}
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">New this month</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">
                {newThisMonth}
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Repeat rate</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">
                {repeatRate}%
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Avg. order value</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5 truncate">
                KES {avgOrderValue.toLocaleString()}
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm p-2">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[13px] font-medium text-slate-500 shrink-0 inline-flex items-center gap-1 pr-1">
              <Tag className="w-3 h-3" />
              Segments:
            </span>
            <button
              onClick={() => setSegmentFilter(null)}
              className={`px-2.5 py-1.5 rounded-sm text-[13px] font-medium transition shrink-0 ${segmentFilter === null
                ? 'bg-blue-950 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              All ({totalCustomers})
            </button>
            {SEGMENTS.map((s) => (
              <button
                key={s}
                onClick={() => setSegmentFilter(s)}
                className={`px-2.5 py-1.5 rounded-sm text-[13px] font-medium transition shrink-0 ${segmentFilter === s
                  ? 'bg-blue-950 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                {s} ({segmentCounts[s] ?? 0})
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, email, phone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              label="Orders"
              value={orderCountFilter}
              options={ORDER_COUNT_OPTIONS}
              labels={{ '1': '1 order', '2-5': '2–5 orders', '5+': '5+ orders' }}
              onChange={setOrderCountFilter}
            />
            <FilterDropdown
              label="Spend"
              value={spentRangeFilter}
              options={SPENT_RANGE_OPTIONS}
              labels={SPENT_LABELS}
              onChange={setSpentRangeFilter}
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

        {selectedIds.length > 0 && (
          <div className="bg-blue-950 text-white rounded-sm px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-medium">
              {selectedIds.length} selected
            </span>
            <button
              onClick={() => {
                setToastMessage('Exported selected customers');
                setSelectedIds([]);
              }}
              className="bg-blue-900 hover:bg-blue-800 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
            >
              Export selected
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-sm flex items-center gap-2 text-[13px]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

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
                  <th className="py-2 px-3 font-medium">Customer</th>
                  <th className="py-2 px-3 font-medium">Contact</th>
                  <th className="py-2 px-3 font-medium">Segment</th>
                  <th className="py-2 px-3 font-medium text-center">Orders</th>
                  <th className="py-2 px-3 font-medium text-right">Spent</th>
                  <th className="py-2 px-3 font-medium">Last order</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 text-[13px]">
                      <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                      Loading customers…
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 text-[13px]">
                      No customers match your filters.
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => {
                    const isSelected = selectedIds.includes(c.id);
                    return (
                      <tr
                        key={c.id}
                        onClick={() => onSelectCustomer(c.id)}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50' : ''
                          }`}
                      >
                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(c.id)}
                            className="rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-950 border border-blue-100 flex items-center justify-center shrink-0 text-[12px] font-semibold">
                              {c.name.slice(0, 1).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">
                                {c.name}
                              </p>
                              <p className="text-[13px] text-slate-400 truncate">
                                {c.location || '—'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <p className="text-slate-600 truncate max-w-[180px]">
                            {c.email}
                          </p>
                          <p className="font-mono text-[13px] text-slate-400">
                            {c.phone || '—'}
                          </p>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${segmentBadge(
                              c.segment,
                            )}`}
                          >
                            {c.segment}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center text-slate-700">
                          {c.ordersCount}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900">
                          {c.totalSpent.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-400">
                          {c.lastOrderDate || '—'}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${c.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-red-50 text-red-600 border-red-100'
                              }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onSelectCustomer(c.id)}
                            className="p-1.5 rounded-sm bg-slate-100 hover:bg-blue-950 hover:text-white text-slate-700 transition"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
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
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. DETAIL VIEW
// ═════════════════════════════════════════════════════════════════════════════
function CustomerDetailPage({
  customerId,
  onBack,
}: {
  customerId: string;
  onBack: () => void;
}) {
  const [customer, setCustomer] = useState<AdminCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  type DetailTab =
    | 'Overview'
    | 'Orders'
    | 'Wishlist & Cart'
    | 'Reviews'
    | 'Support Tickets'
    | 'Communication'
    | 'Addresses'
    | 'Notes';

  const [activeTab, setActiveTab] = useState<DetailTab>('Overview');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [whatsAppText, setWhatsAppText] = useState('');
  const [whatsAppSending, setWhatsAppSending] = useState(false);

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState(
    'Important update regarding your account',
  );
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);

  const [newAddressTitle, setNewAddressTitle] = useState('');
  const [newAddressText, setNewAddressText] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('Nairobi');
  const [addressBusy, setAddressBusy] = useState(false);

  const [newNoteText, setNewNoteText] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);

  const anyModalOpen = whatsAppOpen || emailOpen || blockConfirmOpen;

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (!anyModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setWhatsAppOpen(false);
        setEmailOpen(false);
        setBlockConfirmOpen(false);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [anyModalOpen]);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.customers.detail(Number(customerId));
      setCustomer(res);
      setWhatsAppText(
        `Hello ${res.name}, thank you for being a valued customer.`,
      );
      setEmailBody(
        `Dear ${res.name},\n\nWe appreciate your continued trust in our services.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const toggleBlock = async () => {
    if (!customer) return;
    setBlockBusy(true);
    try {
      const nextBlocked = customer.status === 'Active';
      await adminApi.customers.setBlocked(Number(customerId), nextBlocked);
      setBlockConfirmOpen(false);
      setToastMessage(`Customer ${nextBlocked ? 'blocked' : 'unblocked'}`);
      await fetchDetail();
    } catch {
      setToastMessage('Failed to update status');
    } finally {
      setBlockBusy(false);
    }
  };

  const toggleMarketingConsent = async () => {
    if (!customer) return;
    const next: AdminMarketingConsent =
      customer.marketingConsent === 'Subscribed'
        ? 'Unsubscribed'
        : customer.marketingConsent === 'Unsubscribed'
          ? 'Pending'
          : 'Subscribed';
    try {
      await adminApi.customers.setConsent(Number(customerId), next);
      setToastMessage(`Marketing consent: ${next}`);
      await fetchDetail();
    } catch {
      setToastMessage('Failed to update consent');
    }
  };

  const addAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddressTitle.trim() || !newAddressText.trim()) return;
    setAddressBusy(true);
    try {
      await adminApi.customers.addresses.create(Number(customerId), {
        title: newAddressTitle,
        address: newAddressText,
        city: newAddressCity,
      });
      setNewAddressTitle('');
      setNewAddressText('');
      setToastMessage('Address added');
      await fetchDetail();
    } catch {
      setToastMessage('Failed to add address');
    } finally {
      setAddressBusy(false);
    }
  };

  const deleteAddress = async (id: string) => {
    try {
      await adminApi.customers.addresses.remove(Number(customerId), Number(id));
      setToastMessage('Address removed');
      await fetchDetail();
    } catch {
      setToastMessage('Failed to remove address');
    }
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    setNoteBusy(true);
    try {
      await adminApi.customers.notes.create(Number(customerId), newNoteText.trim());
      setNewNoteText('');
      setToastMessage('Note added');
      await fetchDetail();
    } catch {
      setToastMessage('Failed to add note');
    } finally {
      setNoteBusy(false);
    }
  };

  const sendWhatsApp = async () => {
    if (!whatsAppText.trim()) return;
    setWhatsAppSending(true);
    try {
      await adminApi.customers.whatsapp(Number(customerId), whatsAppText);
      setWhatsAppOpen(false);
      setToastMessage('WhatsApp message sent');
      await fetchDetail();
    } catch {
      setToastMessage('Failed to send WhatsApp');
    } finally {
      setWhatsAppSending(false);
    }
  };

  const sendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) return;
    setEmailSending(true);
    try {
      await adminApi.customers.email(Number(customerId), emailSubject, emailBody);
      setEmailOpen(false);
      setToastMessage('Email dispatched');
      await fetchDetail();
    } catch {
      setToastMessage('Failed to send email');
    } finally {
      setEmailSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[13px] text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading customer…
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center p-3">
        <div className="bg-white border border-slate-200 rounded-sm p-6 max-w-md w-full text-center space-y-3">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-sm flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-[15px] font-semibold text-slate-900">
            Customer not found
          </h1>
          <p className="text-[13px] text-slate-600">
            {error || 'We could not load this customer.'}
          </p>
          <button
            onClick={onBack}
            className="bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-4 rounded-sm text-[13px] transition"
          >
            Back to list
          </button>
        </div>
      </div>
    );
  }

  const segmentBadge = (s: AdminCustomerSegment) =>
    s === 'VIP'
      ? 'bg-amber-50 text-amber-800 border-amber-100'
      : s === 'Loyal'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
        : s === 'New'
          ? 'bg-blue-50 text-blue-950 border-blue-100'
          : s === 'At Risk'
            ? 'bg-red-50 text-red-600 border-red-100'
            : s === 'Churned'
              ? 'bg-slate-100 text-slate-600 border-slate-200'
              : 'bg-slate-50 text-slate-700 border-slate-200';

  const ticketStatusBadge = (s: string) =>
    s === 'Open'
      ? 'bg-amber-50 text-amber-700 border-amber-100'
      : s === 'In Progress'
        ? 'bg-blue-50 text-blue-950 border-blue-100'
        : s === 'Resolved'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
          : 'bg-slate-100 text-slate-600 border-slate-200';

  const priorityBadge = (p: string) =>
    p === 'Urgent'
      ? 'bg-red-50 text-red-600 border-red-100'
      : p === 'High'
        ? 'bg-amber-50 text-amber-700 border-amber-100'
        : p === 'Medium'
          ? 'bg-blue-50 text-blue-950 border-blue-100'
          : 'bg-slate-100 text-slate-600 border-slate-200';

  const channelBadge = (c: string) =>
    c === 'WhatsApp'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : c === 'Email'
        ? 'bg-blue-50 text-blue-950 border-blue-100'
        : c === 'SMS'
          ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
          : 'bg-amber-50 text-amber-700 border-amber-100';

  const avgOrderValue =
    customer.ordersCount > 0
      ? Math.round(customer.totalSpent / customer.ordersCount)
      : 0;

  const tabs: { key: DetailTab; label: string; count?: number }[] = [
    { key: 'Overview', label: 'Overview' },
    { key: 'Orders', label: 'Orders', count: customer.orders.length },
    {
      key: 'Wishlist & Cart',
      label: 'Wishlist & Cart',
      count: customer.wishlist.length + customer.cart.length,
    },
    { key: 'Reviews', label: 'Reviews', count: customer.reviews.length },
    {
      key: 'Support Tickets',
      label: 'Support',
      count: customer.supportTickets.length,
    },
    {
      key: 'Communication',
      label: 'Communication',
      count: customer.communicationLog.length,
    },
    { key: 'Addresses', label: 'Addresses', count: customer.addresses.length },
    { key: 'Notes', label: 'Notes', count: customer.notes.length },
  ];

  return (
    <>
      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onBack}
              className="h-8 w-8 rounded-sm bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="w-10 h-10 rounded-full bg-blue-50 text-blue-950 border border-blue-100 flex items-center justify-center shrink-0 text-[15px] font-semibold">
              {customer.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-[15px] font-semibold text-slate-900 truncate">
                  {customer.name}
                </h1>
                <span
                  className={`inline-block px-1.5 py-0.5 rounded-sm font-medium text-[13px] border ${segmentBadge(
                    customer.segment,
                  )}`}
                >
                  {customer.segment}
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded-sm font-medium text-[13px] border ${customer.status === 'Active'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-red-50 text-red-600 border-red-100'
                    }`}
                >
                  {customer.status}
                </span>
              </div>
              <p className="text-[13px] text-slate-500 font-mono truncate">
                {customer.email} · {customer.phone || '—'} ·{' '}
                {customer.location || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setWhatsAppOpen(true)}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
              <WhatsAppIcon className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <button
              onClick={() => setEmailOpen(true)}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
              <Mail className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Email</span>
            </button>
            <button
              onClick={() => setBlockConfirmOpen(true)}
              className={`inline-flex items-center gap-1.5 font-medium px-3 py-2 rounded-sm text-[13px] transition border ${customer.status === 'Active'
                ? 'bg-white border-red-200 text-red-600 hover:bg-red-50'
                : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {customer.status === 'Active' ? 'Block' : 'Unblock'}
              </span>
            </button>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-3 pb-2 flex items-center gap-1 overflow-x-auto border-t border-slate-100 pt-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium transition shrink-0 ${activeTab === tab.key
                ? 'bg-blue-950 text-white'
                : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`text-[13px] px-1.5 rounded-sm ${activeTab === tab.key
                    ? 'bg-blue-900 text-white'
                    : 'bg-slate-200 text-slate-700'
                    }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3">
        {/* OVERVIEW */}
        {activeTab === 'Overview' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-500">Total orders</p>
                  <p className="text-[15px] font-bold text-slate-900 mt-0.5">
                    {customer.ordersCount}
                  </p>
                </div>
                <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-4 h-4" />
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-500">Lifetime spend</p>
                  <p className="text-[15px] font-bold text-slate-900 mt-0.5 truncate">
                    KES {customer.totalSpent.toLocaleString()}
                  </p>
                </div>
                <span className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-500">Avg. order value</p>
                  <p className="text-[15px] font-bold text-slate-900 mt-0.5 truncate">
                    KES {avgOrderValue.toLocaleString()}
                  </p>
                </div>
                <span className="w-8 h-8 rounded-sm bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-500">Last order</p>
                  <p className="text-[15px] font-bold font-mono text-slate-900 mt-0.5 truncate">
                    {customer.lastOrderDate || '—'}
                  </p>
                </div>
                <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                <p className="text-[13px] font-semibold text-slate-900">Customer profile</p>
                <div className="space-y-2 text-[13px] pt-2 border-t border-slate-100">
                  <div className="flex items-start gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-slate-500">Email</p>
                      <p className="text-slate-900 truncate">{customer.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-slate-500">Phone</p>
                      <p className="text-slate-900 font-mono">{customer.phone || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-slate-500">Location</p>
                      <p className="text-slate-900">{customer.location || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 pt-2 border-t border-slate-100">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-slate-500">Customer since</p>
                      <p className="text-slate-900 font-mono">{customer.dateJoined}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                <p className="text-[13px] font-semibold text-slate-900">Preferences</p>
                <div className="space-y-2 text-[13px] pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Segment</span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${segmentBadge(
                        customer.segment,
                      )}`}
                    >
                      {customer.segment}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Top category</span>
                    <span className="font-medium text-slate-900">
                      {customer.mostPurchasedCategory || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Preferred payment</span>
                    <span className="font-medium text-emerald-700">
                      {customer.preferredPayment || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-slate-500 inline-flex items-center gap-1">
                      <Bell className="w-3 h-3" />
                      Marketing
                    </span>
                    <button
                      onClick={toggleMarketingConsent}
                      className={`inline-block px-2 py-0.5 rounded-sm font-medium border transition ${customer.marketingConsent === 'Subscribed'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                        : customer.marketingConsent === 'Unsubscribed'
                          ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100'
                        }`}
                    >
                      {customer.marketingConsent}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                <p className="text-[13px] font-semibold text-slate-900">Recent activity</p>
                <div className="space-y-2 text-[13px] pt-2 border-t border-slate-100">
                  {customer.communicationLog.slice(0, 3).map((log) => (
                    <div key={log.id} className="flex items-start gap-2">
                      <span
                        className={`w-6 h-6 rounded-sm flex items-center justify-center shrink-0 border ${channelBadge(
                          log.channel,
                        )}`}
                      >
                        {log.channel === 'WhatsApp' && <WhatsAppIcon className="w-3 h-3" />}
                        {log.channel === 'Email' && <Mail className="w-3 h-3" />}
                        {log.channel === 'SMS' && <Send className="w-3 h-3" />}
                        {log.channel === 'Call' && <Phone className="w-3 h-3" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-slate-900 truncate">{log.subject}</p>
                        <p className="text-slate-400 font-mono">{log.date}</p>
                      </div>
                    </div>
                  ))}
                  {customer.communicationLog.length === 0 && (
                    <p className="text-[13px] text-slate-400 italic">No activity yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm">
              <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-slate-900">Recent orders</p>
                <button
                  onClick={() => setActiveTab('Orders')}
                  className="text-[13px] text-blue-950 hover:underline font-medium"
                >
                  View all
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <th className="py-2 px-3 font-medium">Order #</th>
                      <th className="py-2 px-3 font-medium">Date</th>
                      <th className="py-2 px-3 font-medium text-center">Items</th>
                      <th className="py-2 px-3 font-medium text-right">Total</th>
                      <th className="py-2 px-3 font-medium">Payment</th>
                      <th className="py-2 px-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customer.orders.slice(0, 3).map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-medium text-blue-950">
                          {ord.orderNumber}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-400">
                          {ord.date}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-700">
                          {ord.itemsCount}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900">
                          {ord.total.toLocaleString()}
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-block px-2 py-0.5 rounded-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                            {ord.paymentMethod}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-block px-2 py-0.5 rounded-sm font-medium bg-blue-50 text-blue-950 border border-blue-100">
                            {ord.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {customer.orders.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No orders yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ORDERS */}
        {activeTab === 'Orders' && (
          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200">
              <p className="text-[13px] font-semibold text-slate-900">
                Order history · {customer.orders.length}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <th className="py-2 px-3 font-medium">Order #</th>
                    <th className="py-2 px-3 font-medium">Date</th>
                    <th className="py-2 px-3 font-medium text-center">Items</th>
                    <th className="py-2 px-3 font-medium text-right">Total</th>
                    <th className="py-2 px-3 font-medium">Payment</th>
                    <th className="py-2 px-3 font-medium">Fulfillment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customer.orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-medium text-blue-950">
                        {ord.orderNumber}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-400">{ord.date}</td>
                      <td className="py-2 px-3 text-center text-slate-700">
                        {ord.itemsCount}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-slate-900">
                        {ord.total.toLocaleString()}
                      </td>
                      <td className="py-2 px-3">
                        <span className="inline-block px-2 py-0.5 rounded-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {ord.paymentMethod}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="inline-block px-2 py-0.5 rounded-sm font-medium bg-blue-50 text-blue-950 border border-blue-100">
                          {ord.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* WISHLIST & CART */}
        {activeTab === 'Wishlist & Cart' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-white border border-slate-200 rounded-sm">
              <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-red-500" />
                  <p className="text-[13px] font-semibold text-slate-900">
                    Wishlist · {customer.wishlist.length}
                  </p>
                </div>
              </div>
              <div className="p-2 space-y-2">
                {customer.wishlist.length === 0 ? (
                  <p className="text-[13px] text-slate-400 italic text-center py-6">
                    No wishlist items.
                  </p>
                ) : (
                  customer.wishlist.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-50 border border-slate-200 rounded-sm p-2 flex items-center gap-2"
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt=""
                          className="w-10 h-10 rounded-sm object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <span className="w-10 h-10 rounded-sm bg-slate-100 border border-slate-200 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-slate-900 truncate">
                          {item.productName}
                        </p>
                        <p className="text-[13px] font-mono text-slate-400">
                          {item.sku} · Added {item.addedDate}
                        </p>
                      </div>
                      <span className="font-mono font-medium text-slate-900 shrink-0">
                        KES {item.price.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm">
              <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-blue-950" />
                  <p className="text-[13px] font-semibold text-slate-900">
                    Cart · {customer.cart.length}
                  </p>
                </div>
              </div>
              <div className="p-2 space-y-2">
                {customer.cart.length === 0 ? (
                  <p className="text-[13px] text-slate-400 italic text-center py-6">
                    Cart is empty.
                  </p>
                ) : (
                  customer.cart.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-50 border border-slate-200 rounded-sm p-2 flex items-center gap-2"
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt=""
                          className="w-10 h-10 rounded-sm object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <span className="w-10 h-10 rounded-sm bg-slate-100 border border-slate-200 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-slate-900 truncate">
                          {item.productName}
                        </p>
                        <p className="text-[13px] font-mono text-slate-400">
                          {item.sku} · Qty {item.qty} · Added {item.addedDate}
                        </p>
                      </div>
                      <span className="font-mono font-medium text-slate-900 shrink-0">
                        KES {(item.price * item.qty).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* REVIEWS */}
        {activeTab === 'Reviews' && (
          <div className="bg-white border border-slate-200 rounded-sm">
            <div className="px-3 py-2 border-b border-slate-200">
              <p className="text-[13px] font-semibold text-slate-900">
                Product reviews · {customer.reviews.length}
              </p>
            </div>
            <div className="p-2 space-y-2">
              {customer.reviews.length === 0 ? (
                <p className="text-[13px] text-slate-400 italic text-center py-6">
                  No reviews submitted yet.
                </p>
              ) : (
                customer.reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-900 truncate">
                          {rev.productName}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3 h-3 ${star <= rev.rating
                                ? 'text-amber-500 fill-amber-500'
                                : 'text-slate-300'
                                }`}
                            />
                          ))}
                          <span className="text-[13px] text-slate-500 ml-1">
                            {rev.rating}.0
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium text-[13px] border ${rev.status === 'Published'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : rev.status === 'Pending'
                              ? 'bg-amber-50 text-amber-700 border-amber-100'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                        >
                          {rev.status}
                        </span>
                        <span className="text-[13px] font-mono text-slate-400">
                          {rev.date}
                        </span>
                      </div>
                    </div>
                    <p className="text-[13px] text-slate-600">{rev.comment}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* SUPPORT TICKETS */}
        {activeTab === 'Support Tickets' && (
          <div className="bg-white border border-slate-200 rounded-sm">
            <div className="px-3 py-2 border-b border-slate-200">
              <p className="text-[13px] font-semibold text-slate-900">
                Support tickets · {customer.supportTickets.length}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <th className="py-2 px-3 font-medium">Subject</th>
                    <th className="py-2 px-3 font-medium">Priority</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 font-medium">Opened</th>
                    <th className="py-2 px-3 font-medium">Last update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customer.supportTickets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 text-[13px]">
                        No support tickets.
                      </td>
                    </tr>
                  ) : (
                    customer.supportTickets.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {t.subject}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${priorityBadge(
                              t.priority,
                            )}`}
                          >
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${ticketStatusBadge(
                              t.status,
                            )}`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-400">{t.date}</td>
                        <td className="py-2 px-3 font-mono text-slate-400">
                          {t.lastUpdate}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* COMMUNICATION */}
        {activeTab === 'Communication' && (
          <div className="bg-white border border-slate-200 rounded-sm">
            <div className="px-3 py-2 border-b border-slate-200">
              <p className="text-[13px] font-semibold text-slate-900">
                Communication history · {customer.communicationLog.length}
              </p>
            </div>
            <div className="p-2 space-y-2">
              {customer.communicationLog.length === 0 ? (
                <p className="text-[13px] text-slate-400 italic text-center py-6">
                  No communication recorded.
                </p>
              ) : (
                customer.communicationLog.map((log) => (
                  <div
                    key={log.id}
                    className="bg-slate-50 border border-slate-200 rounded-sm p-2 flex items-start gap-2"
                  >
                    <span
                      className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 border ${channelBadge(
                        log.channel,
                      )}`}
                    >
                      {log.channel === 'WhatsApp' && <WhatsAppIcon className="w-4 h-4" />}
                      {log.channel === 'Email' && <Mail className="w-4 h-4" />}
                      {log.channel === 'SMS' && <Send className="w-4 h-4" />}
                      {log.channel === 'Call' && <Phone className="w-4 h-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-medium text-slate-900">
                          {log.subject}
                        </span>
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded-sm font-medium text-[13px] border ${log.direction === 'Inbound'
                            ? 'bg-blue-50 text-blue-950 border-blue-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            }`}
                        >
                          {log.direction}
                        </span>
                      </div>
                      <p className="text-[13px] text-slate-500 mt-0.5">
                        {log.channel} · by {log.agent || 'System'}
                      </p>
                    </div>
                    <span className="text-[13px] font-mono text-slate-400 shrink-0">
                      {log.date}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ADDRESSES */}
        {activeTab === 'Addresses' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {customer.addresses.length === 0 ? (
                <p className="text-[13px] text-slate-400 italic py-6 col-span-full text-center">
                  No addresses on file.
                </p>
              ) : (
                customer.addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="bg-white border border-slate-200 rounded-sm p-2 space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-blue-950 shrink-0" />
                          <span className="text-[13px] font-medium text-slate-900 truncate">
                            {addr.title}
                          </span>
                        </div>
                        {addr.isDefault && (
                          <span className="bg-blue-50 text-blue-950 border border-blue-100 text-[13px] font-medium px-1.5 py-0.5 rounded-sm shrink-0">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-slate-600 mt-1">
                        {addr.address}
                      </p>
                      <p className="text-[13px] text-slate-400 mt-0.5">{addr.city}</p>
                    </div>
                    <div className="flex justify-end gap-1 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => setToastMessage('Edit address not supported yet')}
                        className="p-1.5 rounded-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteAddress(addr.id)}
                        className="p-1.5 rounded-sm bg-red-50 hover:bg-red-100 text-red-600 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-sm p-2 max-w-xl space-y-2">
              <p className="text-[13px] font-semibold text-slate-900">
                Add new address
              </p>
              <form onSubmit={addAddress} className="space-y-3 text-[13px]">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Label *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Workspace"
                    value={newAddressTitle}
                    onChange={(e) => setNewAddressTitle(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Street address *
                  </label>
                  <input
                    type="text"
                    placeholder="Street, building, apartment"
                    value={newAddressText}
                    onChange={(e) => setNewAddressText(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={newAddressCity}
                    onChange={(e) => setNewAddressCity(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={
                      addressBusy ||
                      !newAddressTitle.trim() ||
                      !newAddressText.trim()
                    }
                    className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {addressBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save address
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* NOTES */}
        {activeTab === 'Notes' && (
          <div className="max-w-2xl space-y-3">
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2 text-[13px]">
              <p className="font-semibold text-slate-900">Internal notes</p>

              {customer.notes.length === 0 ? (
                <p className="text-[13px] text-slate-400 italic">No notes yet.</p>
              ) : (
                <div className="space-y-2">
                  {customer.notes.map((note) => (
                    <div
                      key={note.id}
                      className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-medium text-slate-800">
                          {note.author}
                        </span>
                        <span className="text-[13px] font-mono text-slate-400">
                          {note.date}
                        </span>
                      </div>
                      <p className="text-[13px] text-slate-600">{note.text}</p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={addNote} className="space-y-2 pt-2 border-t border-slate-100">
                <textarea
                  rows={3}
                  placeholder="Type a confidential note…"
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={noteBusy || !newNoteText.trim()}
                    className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {noteBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Add note
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* WHATSAPP MODAL */}
      {whatsAppOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setWhatsAppOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-lg w-full p-3 shadow-xl space-y-3 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold text-slate-900 inline-flex items-center gap-2">
                <WhatsAppIcon className="w-4 h-4 text-emerald-600" />
                Send WhatsApp message
              </p>
              <button
                onClick={() => setWhatsAppOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-[13px] font-medium text-slate-500 mb-1">
                Live preview
              </p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-2 text-slate-800">
                <p className="whitespace-pre-line">{whatsAppText}</p>
                <p className="text-[13px] text-slate-400 text-right mt-1">
                  Just now ✓✓
                </p>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Message</label>
              <textarea
                rows={4}
                value={whatsAppText}
                onChange={(e) => setWhatsAppText(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setWhatsAppOpen(false)}
                disabled={whatsAppSending}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={sendWhatsApp}
                disabled={whatsAppSending || !whatsAppText.trim()}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
              >
                {whatsAppSending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <WhatsAppIcon className="w-4 h-4" />
                )}
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL MODAL */}
      {emailOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setEmailOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-lg w-full p-3 shadow-xl space-y-3 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold text-slate-900">Send email</p>
              <button
                onClick={() => setEmailOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Body</label>
              <textarea
                rows={5}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEmailOpen(false)}
                disabled={emailSending}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={sendEmail}
                disabled={emailSending || !emailSubject.trim() || !emailBody.trim()}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
              >
                {emailSending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Mail className="w-3.5 h-3.5" />
                )}
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BLOCK CONFIRM */}
      {blockConfirmOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setBlockConfirmOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl text-center space-y-3 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`w-10 h-10 rounded-sm flex items-center justify-center mx-auto ${customer.status === 'Active'
                ? 'bg-red-50 text-red-600'
                : 'bg-emerald-50 text-emerald-700'
                }`}
            >
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">
                {customer.status === 'Active' ? 'Block customer?' : 'Unblock customer?'}
              </h3>
              <p className="text-[13px] text-slate-500 mt-1">
                {customer.status === 'Active'
                  ? 'They will not be able to log in or place new orders.'
                  : 'Their full purchasing privileges will be restored.'}
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => setBlockConfirmOpen(false)}
                disabled={blockBusy}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={toggleBlock}
                disabled={blockBusy}
                className={`flex-1 font-medium py-2 rounded-sm text-[13px] text-white disabled:opacity-50 inline-flex items-center justify-center gap-1.5 ${customer.status === 'Active'
                  ? 'bg-red-600 hover:bg-red-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
              >
                {blockBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// FilterDropdown — unchanged
// ═════════════════════════════════════════════════════════════════════════════
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
  const display = value ? labels?.[value] ?? value : label;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 border rounded-sm px-3 py-2 text-[13px] font-medium transition whitespace-nowrap ${isActive
          ? 'bg-blue-50 border-blue-950 text-blue-950'
          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
      >
        {display}
        <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 w-56 rounded-sm border border-slate-200 bg-white shadow-lg z-50 p-1">
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`w-full text-left px-2 py-2 rounded-sm text-[13px] ${!isActive
              ? 'bg-blue-50 text-blue-950 font-medium'
              : 'text-slate-700 hover:bg-slate-50'
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
                className={`w-full text-left px-2 py-2 rounded-sm text-[13px] flex items-center justify-between ${selected
                  ? 'bg-blue-50 text-blue-950 font-medium'
                  : 'text-slate-700 hover:bg-slate-50'
                  }`}
              >
                <span className="truncate">{labels?.[opt] ?? opt}</span>
                {selected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}