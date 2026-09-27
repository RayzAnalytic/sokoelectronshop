// app/admin/discounts/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Tag,
  Percent,
  DollarSign,
  Truck,
  Gift,
  Trash2,
  Copy,
  CheckCircle2,
  X,
  Flame,
  Zap,
  CheckSquare,
  Square,
  Edit,
} from 'lucide-react';
import AddDiscountModal from '@/components/admin/AddDiscountModal';
import {
  useDiscounts,
  computeStatus,
  type Discount,
  type DiscountPayload as StoreDiscountPayload,
  type DiscountStatus,
} from '@/lib/store/discounts';

const TYPE_ICONS: Record<string, any> = {
  Percentage: Percent,
  'Fixed Amount': DollarSign,
  'Free Shipping': Truck,
  'Buy X Get Y': Gift,
};

export default function DiscountsPage() {
  const discounts = useDiscounts((s) => s.items);
  const hydrate = useDiscounts((s) => s.hydrate);
  const addDiscount = useDiscounts((s) => s.addDiscount);
  const updateDiscount = useDiscounts((s) => s.updateDiscount);
  const removeDiscount = useDiscounts((s) => s.removeDiscount);
  const removeMany = useDiscounts((s) => s.removeMany);
  const duplicateDiscount = useDiscounts((s) => s.duplicateDiscount);
  const toggleMostDeal = useDiscounts((s) => s.toggleMostDeal);

  const [activeTab, setActiveTab] = useState<DiscountStatus>('Active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const toModalInitial = (
    disc: Discount | null
  ): React.ComponentProps<typeof AddDiscountModal>['initial'] => {
    if (!disc) return null;

    const eligibility =
      disc.eligibility === 'All Customers' ||
      disc.eligibility === 'Specific Customers' ||
      disc.eligibility === 'First-time Buyers'
        ? disc.eligibility
        : 'All Customers';

    const targetAudience =
      disc.targetAudience === 'All People & Customers' ||
      disc.targetAudience === 'Registered Only' ||
      disc.targetAudience === 'VIP Members'
        ? disc.targetAudience
        : 'All People & Customers';

    return {
      ...disc,
      eligibility,
      targetAudience,
    } as React.ComponentProps<typeof AddDiscountModal>['initial'];
  };

  // Hydrate on mount (no-op if already done)
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const flash = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Counts are computed from live statuses (dates may have shifted since load)
  const counts = useMemo(
    () => ({
      Active: discounts.filter(
        (d) => computeStatus(d.startDate, d.endDate) === 'Active'
      ).length,
      Scheduled: discounts.filter(
        (d) => computeStatus(d.startDate, d.endDate) === 'Scheduled'
      ).length,
      Expired: discounts.filter(
        (d) => computeStatus(d.startDate, d.endDate) === 'Expired'
      ).length,
    }),
    [discounts]
  );

  const filtered = useMemo(() => {
    return discounts.filter((d) => {
      const liveStatus = computeStatus(d.startDate, d.endDate);
      if (liveStatus !== activeTab) return false;
      const q = searchQuery.toLowerCase();
      return (
        !q ||
        d.code.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q)
      );
    });
  }, [discounts, activeTab, searchQuery]);

  const allSelected =
    filtered.length > 0 && selectedIds.length === filtered.length;
  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? [] : filtered.map((d) => d.id));
  const toggleRow = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );

  const handleSave = (payload: StoreDiscountPayload) => {
    if (payload.id) {
      updateDiscount(payload.id, payload);
      flash(`Discount ${payload.code} updated`);
    } else {
      addDiscount(payload);
      flash(`Discount ${payload.code} created`);
    }
  };

  const handleDuplicate = (disc: Discount) => {
    const dup = duplicateDiscount(disc.id);
    if (dup) flash(`Duplicated as ${dup.code}`);
  };

  const handleToggleMostDeal = (disc: Discount) => {
    toggleMostDeal(disc.id);
    flash(
      `${disc.code} ${!disc.isMostDeal ? 'marked as Top Deal' : 'removed from Top Deals'}`
    );
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    removeDiscount(deleteId);
    setDeleteId(null);
    flash('Discount deleted');
  };

  const bulkDelete = () => {
    removeMany(selectedIds);
    setSelectedIds([]);
    flash('Selected discounts deleted');
  };

  const activeLiveDeals = discounts.filter(
    (d) =>
      d.isMostDeal && computeStatus(d.startDate, d.endDate) === 'Active'
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">
      {/* TOAST */}
      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              Discounts & deals
              <span className="inline-flex items-center gap-1 text-[13px] font-medium bg-amber-50 text-amber-800 border border-amber-100 px-2 py-0.5 rounded-sm">
                <Flame className="w-3 h-3 text-amber-600" />
                Public broadcast
              </span>
            </h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Codes, flash sales, and top deals reflected on the storefront
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setAddOpen(true);
            }}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create discount</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">
        {/* HIGHLIGHT BANNER */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 rounded-sm p-3 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-sm bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
            </span>
            <div>
              <p className="text-[13px] font-semibold">
                Most deals & storefront broadcasts
              </p>
              <p className="text-[13px] text-slate-300 mt-0.5 max-w-2xl">
                Discounts marked as &ldquo;Top Deal&rdquo; are automatically
                pinned to the customer catalog, WhatsApp catalog, and checkout
                banners.
              </p>
            </div>
          </div>
          <div className="bg-white/10 border border-white/10 px-3 py-2 rounded-sm text-center shrink-0">
            <p className="text-[13px] text-slate-300">Live public deals</p>
            <p className="text-[15px] font-semibold text-amber-400 font-mono mt-0.5">
              {activeLiveDeals} active
            </p>
          </div>
        </div>

        {/* TABS + SEARCH */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-sm">
            {(['Active', 'Scheduled', 'Expired'] as DiscountStatus[]).map(
              (tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setSelectedIds([]);
                  }}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium transition ${
                    activeTab === tab
                      ? 'bg-white text-blue-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab}
                  <span
                    className={`px-1.5 py-0.5 rounded-sm text-[13px] ${
                      activeTab === tab
                        ? 'bg-blue-50 text-blue-950'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {counts[tab]}
                  </span>
                </button>
              )
            )}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search code or description…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>
        </div>

        {/* BULK */}
        {selectedIds.length > 0 && (
          <div className="bg-blue-950 text-white rounded-sm px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[13px]">
              <span className="bg-blue-900 font-medium px-2 py-0.5 rounded-sm">
                {selectedIds.length} selected
              </span>
            </div>
            <button
              onClick={bulkDelete}
              className="bg-red-600 hover:bg-red-500 px-2.5 py-2 rounded-sm text-[13px] font-medium inline-flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete selected
            </button>
          </div>
        )}

        {/* TABLE */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2 px-3 w-10">
                    <button
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-slate-700"
                      aria-label="Select all"
                    >
                      {allSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-950" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-2 px-3 font-medium">Code</th>
                  <th className="py-2 px-3 font-medium">Type</th>
                  <th className="py-2 px-3 font-medium text-right">Value</th>
                  <th className="py-2 px-3 font-medium text-right">
                    Min. order
                  </th>
                  <th className="py-2 px-3 font-medium text-center">Usage</th>
                  <th className="py-2 px-3 font-medium text-center">
                    Top deal
                  </th>
                  <th className="py-2 px-3 font-medium">Start</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-12 text-center text-slate-400"
                    >
                      No {activeTab.toLowerCase()} discounts found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((disc) => {
                    const TypeIcon = TYPE_ICONS[disc.type] ?? Percent;
                    const isSelected = selectedIds.includes(disc.id);
                    const liveStatus = computeStatus(
                      disc.startDate,
                      disc.endDate
                    );
                    const statusBadge =
                      liveStatus === 'Active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : liveStatus === 'Scheduled'
                        ? 'bg-amber-50 text-amber-700 border-amber-100'
                        : 'bg-slate-100 text-slate-500 border-slate-200';

                    return (
                      <tr
                        key={disc.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          isSelected ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <td className="py-2 px-3">
                          <button
                            onClick={() => toggleRow(disc.id)}
                            className="text-slate-400 hover:text-slate-700"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-950" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            {disc.image && (
                              <img
                                src={disc.image}
                                alt=""
                                className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-medium text-blue-950">
                                  {disc.code}
                                </span>
                                {disc.isMostDeal && (
                                  <span className="inline-flex items-center gap-0.5 text-[13px] font-medium bg-amber-50 text-amber-800 border border-amber-100 px-1.5 py-0.5 rounded-sm">
                                    <Zap className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                                    Top deal
                                  </span>
                                )}
                              </div>
                              <p className="text-[13px] text-slate-400 truncate max-w-xs">
                                {disc.description}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-sm text-slate-700">
                            <TypeIcon className="w-3 h-3 text-slate-500" />
                            {disc.type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900">
                          {disc.value}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">
                          KES {disc.minOrder.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="font-medium text-slate-900">
                            {disc.usageCount}
                          </span>
                          <span className="text-slate-400">
                            {' '}
                            / {disc.usageLimit}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleToggleMostDeal(disc)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[13px] font-medium transition ${
                              disc.isMostDeal
                                ? 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                                : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                            }`}
                            title="Toggle Top Deal visibility"
                          >
                            <Flame
                              className={`w-3 h-3 ${
                                disc.isMostDeal
                                  ? 'text-amber-600 fill-amber-500'
                                  : 'text-slate-400'
                              }`}
                            />
                            {disc.isMostDeal ? 'Featured' : 'Standard'}
                          </button>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500">
                          {disc.startDate}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${statusBadge}`}
                          >
                            {liveStatus}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditing(disc);
                                setAddOpen(true);
                              }}
                              title="Edit"
                              className="p-1.5 text-slate-400 hover:text-slate-900 rounded-sm hover:bg-slate-100 transition"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDuplicate(disc)}
                              title="Duplicate"
                              className="p-1.5 text-slate-400 hover:text-slate-900 rounded-sm hover:bg-slate-100 transition"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteId(disc.id)}
                              title="Delete"
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-sm transition"
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
        </div>
      </main>

      {/* ADD / EDIT MODAL */}
      <AddDiscountModal
        open={addOpen}
        initial={toModalInitial(editing)}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        onSave={(d) => handleSave(d as StoreDiscountPayload)}
      />

      {/* DELETE CONFIRM */}
      {deleteId && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setDeleteId(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-sm bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-[15px] font-semibold text-slate-900 mt-2">
              Delete discount?
            </h3>
            <p className="text-[13px] text-slate-500 mt-1">
              Customers will no longer be able to apply this code or see it in
              top deals.
            </p>
            <div className="flex justify-center gap-2 mt-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-sm text-[13px]"
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
