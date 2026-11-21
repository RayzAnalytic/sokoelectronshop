'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Check,
  X,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  DollarSign,
  Copy,
  CheckSquare,
  Square,
  Link2,
  Phone,
  User,
} from 'lucide-react';

import { adminApi } from '@/lib/admin-api';
import type {
  AdminTransaction,
  AdminTransactionSummary,
  AdminTransactionFilters,
  AdminTransactionMethod,
  AdminTransactionStatus,
} from '@/lib/admin-types';

const STATUS_OPTIONS: AdminTransactionStatus[] = [
  'Success',
  'Pending',
  'Failed',
  'Reversed',
];

const METHOD_OPTIONS: { value: AdminTransactionMethod; label: string }[] = [
  { value: 'MPESA', label: 'M-Pesa' },
  { value: 'COD', label: 'Cash on Delivery' },
];

const DATE_RANGES = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days'] as const;

const fmtMoney = (v: string | number): string =>
  `KES ${Number(v || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;

const fmtNumber = (v: string | number): string =>
  Number(v || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 });

export default function TransactionsLedgerPage() {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [summary, setSummary] = useState<AdminTransactionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<AdminTransactionStatus | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<AdminTransactionMethod | null>(null);
  const [dateRange, setDateRange] = useState<typeof DATE_RANGES[number]>('Today');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [activeTx, setActiveTx] = useState<AdminTransaction | null>(null);
  const [reconcileTx, setReconcileTx] = useState<AdminTransaction | null>(null);
  const [reconcileStatus, setReconcileStatus] = useState<'Matched' | 'Unmatched'>('Matched');
  const [reconcileOrder, setReconcileOrder] = useState('');
  const [reconcileNote, setReconcileNote] = useState('');
  const [busy, setBusy] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const filters: AdminTransactionFilters = useMemo(() => {
    const f: AdminTransactionFilters = {};
    if (debouncedSearch) f.q = debouncedSearch;
    if (selectedStatus) f.status = selectedStatus;
    if (selectedMethod) f.method = selectedMethod;
    if (dateRange) f.dateRange = dateRange;
    if (minAmount) f.minAmount = minAmount;
    if (maxAmount) f.maxAmount = maxAmount;
    return f;
  }, [
    debouncedSearch,
    selectedStatus,
    selectedMethod,
    dateRange,
    minAmount,
    maxAmount,
  ]);

  const fetchAll = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const [list, sum] = await Promise.all([
          adminApi.transactions.list(filters, signal),
          adminApi.transactions.summary(filters, signal),
        ]);
        if (signal.aborted) return;
        setTransactions(list);
        setSummary(sum);
      } catch (err) {
        if (signal.aborted) return;
        const message =
          err instanceof Error ? err.message : 'Failed to load transactions.';
        setError(message);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchAll(controller.signal);
    return () => controller.abort();
  }, [fetchAll]);

  const totalSuccessful = summary?.totalSuccessful ?? '0';
  const totalPending = summary?.totalPending ?? '0';
  const totalFailed = summary?.totalFailed ?? '0';
  const totalFees = summary?.totalFees ?? '0';
  const netAmount = summary?.netAmount ?? '0';

  const allSelected =
    transactions.length > 0 && selectedIds.length === transactions.length;
  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? [] : transactions.map((t) => t.id));
  const toggleRow = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );

  const handleRetry = async (tx: AdminTransaction) => {
    if (busy) return;
    setBusy(true);
    try {
      const fresh = await adminApi.transactions.retry(tx.id);
      setToastMessage(
        `Retry initiated · new attempt ${fresh.checkoutRequestId || fresh.id}`,
      );
      const controller = new AbortController();
      await fetchAll(controller.signal);
      setActiveTx(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Retry failed.';
      setToastMessage(message);
    } finally {
      setBusy(false);
    }
  };

  const saveReconciliation = async () => {
    if (!reconcileTx || busy) return;
    setBusy(true);
    try {
      await adminApi.transactions.reconcile(reconcileTx.id, {
        status: reconcileStatus,
        orderNumber: reconcileOrder || undefined,
        note: reconcileNote || undefined,
      });
      setToastMessage(`Transaction ${reconcileTx.ref || reconcileTx.id} reconciled`);
      setReconcileTx(null);
      setReconcileNote('');
      setReconcileOrder('');
      const controller = new AbortController();
      await fetchAll(controller.signal);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Reconcile failed.';
      setToastMessage(message);
    } finally {
      setBusy(false);
    }
  };

  const handleExportFiltered = async () => {
    try {
      await adminApi.transactions.exportFiltered(filters);
      setToastMessage(`Exported ${transactions.length} transactions`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Export failed.';
      setToastMessage(message);
    }
  };

  const handleExportSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      await adminApi.transactions.exportBulk({ ids: selectedIds });
      setToastMessage(`Exported ${selectedIds.length} transactions`);
      setSelectedIds([]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Export failed.';
      setToastMessage(message);
    }
  };

  const activeFilterCount =
    (selectedStatus ? 1 : 0) +
    (selectedMethod ? 1 : 0) +
    (minAmount || maxAmount ? 1 : 0);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedStatus(null);
    setSelectedMethod(null);
    setMinAmount('');
    setMaxAmount('');
  };

  const statusBadge = (s: AdminTransactionStatus) =>
    s === 'Success'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'Failed'
        ? 'bg-red-50 text-red-600 border-red-100'
        : s === 'Reversed'
          ? 'bg-purple-50 text-purple-700 border-purple-100'
          : 'bg-amber-50 text-amber-700 border-amber-100';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12 relative">
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-[110] bg-slate-900 text-white px-3 py-2 rounded shadow-lg flex items-center gap-2 text-[12px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1700px] mx-auto px-3 py-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[14px] font-semibold text-slate-900">Transactions</h1>
            <p className="text-[12px] text-slate-500 mt-0.5 truncate">
              Financial ledger & payment event stream
            </p>
          </div>
          <button
            onClick={handleExportFiltered}
            disabled={loading || transactions.length === 0}
            className="inline-flex items-center gap-1 bg-blue-950 hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-2.5 py-1.5 rounded text-[12px] transition shrink-0"
          >
            <Download className="w-3 h-3" />
            <span>Export CSV</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1700px] mx-auto px-0.5 py-2.5 space-y-2">
       

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-2 flex items-start justify-between gap-2">
            <div className="text-[12px]">
              <p className="font-medium text-red-800">Could not load the ledger</p>
              <p className="text-red-700 mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => {
                const controller = new AbortController();
                fetchAll(controller.signal);
              }}
              className="text-[13px] font-medium text-red-800 hover:underline whitespace-nowrap"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-1.5">
          <div className="bg-white border border-slate-200 rounded p-2 flex items-start gap-2">
            <span className="w-7 h-7 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500 truncate">Successful</p>
              <p className="text-[14px] font-semibold text-slate-900 truncate">
                {fmtMoney(totalSuccessful)}
              </p>
              <p className="text-[12px] text-emerald-600 mt-0.5 inline-flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" /> Completed
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded p-2 flex items-start gap-2">
            <span className="w-7 h-7 rounded bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500 truncate">Pending</p>
              <p className="text-[14px] font-semibold text-slate-900 truncate">
                {fmtMoney(totalPending)}
              </p>
              <p className="text-[13px] text-amber-600 mt-0.5">Awaiting callback</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded p-2 flex items-start gap-2">
            <span className="w-7 h-7 rounded bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <XCircle className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500 truncate">Failed</p>
              <p className="text-[14px] font-semibold text-slate-900 truncate">
                {fmtMoney(totalFailed)}
              </p>
              <p className="text-[13px] text-red-600 mt-0.5 inline-flex items-center gap-0.5">
                <ArrowDownRight className="w-3 h-3" /> Declined
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded p-2 flex items-start gap-2">
            <span className="w-7 h-7 rounded bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
              <DollarSign className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500 truncate">Gateway Fees</p>
              <p className="text-[14px] font-semibold text-slate-900 truncate">
                {fmtMoney(totalFees)}
              </p>
              <p className="text-[13px] text-indigo-600 mt-0.5">Deductions</p>
            </div>
          </div>

          <div className="bg-blue-950 text-white border border-blue-900 rounded p-2 flex items-start gap-2 col-span-2 lg:col-span-1">
            <span className="w-7 h-7 rounded bg-blue-900 text-blue-100 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-blue-300 truncate">Net settled</p>
              <p className="text-[14px] font-semibold text-white truncate">
                {fmtMoney(netAmount)}
              </p>
              <p className="text-[12px] text-emerald-400 mt-0.5">Ledger balance</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded p-0.5 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ref, order #, phone, customer…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded pl-8 pr-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <FilterDropdown
              label="Status"
              value={selectedStatus}
              options={STATUS_OPTIONS as unknown as string[]}
              onChange={(v) => setSelectedStatus(v as AdminTransactionStatus | null)}
            />
            <FilterDropdown
              label="Method"
              value={selectedMethod ? METHOD_OPTIONS.find((m) => m.value === selectedMethod)?.label ?? null : null}
              options={METHOD_OPTIONS.map((m) => m.label)}
              onChange={(label) => {
                if (label === null) {
                  setSelectedMethod(null);
                  return;
                }
                const match = METHOD_OPTIONS.find((m) => m.label === label);
                setSelectedMethod(match ? match.value : null);
              }}
            />
            <FilterDropdown
              label={dateRange}
              value={null}
              options={DATE_RANGES as unknown as string[]}
              onChange={(v) => setDateRange((v ?? 'Today') as typeof DATE_RANGES[number])}
            />

            <div className="flex items-center gap-1">
              <input
                type="number"
                placeholder="Min"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-16 bg-white border border-slate-200 rounded px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
              <span className="text-slate-400 text-[12px]">–</span>
              <input
                type="number"
                placeholder="Max"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="w-16 bg-white border border-slate-200 rounded px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-[13px] text-red-600 hover:underline font-medium px-1.5 py-1.5"
              >
                Clear ({activeFilterCount})
              </button>
            )}
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="bg-blue-950 text-white rounded px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-medium">{selectedIds.length} selected</span>
            <button
              onClick={handleExportSelected}
              disabled={busy}
              className="bg-blue-900 hover:bg-blue-800 disabled:opacity-50 px-2.5 py-1.5 rounded text-[13px] font-medium transition"
            >
              Export selected
            </button>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-[13px] font-medium text-slate-700">
              Ledger entries · {transactions.length}
              {loading && <span className="text-slate-400 ml-2">loading…</span>}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-1.5 px-2 w-8">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-700">
                      {allSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-blue-950" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </th>
                  <th className="py-1.5 px-2 font-medium">Ref</th>
                  <th className="py-1.5 px-2 font-medium">Order #</th>
                  <th className="py-1.5 px-2 font-medium text-right">Amount</th>
                  <th className="py-1.5 px-2 font-medium text-right">Fee</th>
                  <th className="py-1.5 px-2 font-medium">Phone</th>
                  <th className="py-1.5 px-2 font-medium">Status</th>
                  <th className="py-1.5 px-2 font-medium">Code</th>
                  <th className="py-1.5 px-2 font-medium">Date</th>
                  <th className="py-1.5 px-2 w-28"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && transactions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-slate-400 text-[13px]">
                      Loading transactions…
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-slate-400 text-[13px]">
                      No transactions match your filters.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const isSelected = selectedIds.includes(tx.id);
                    return (
                      <tr
                        key={tx.id}
                        onClick={() => setActiveTx(tx)}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                          isSelected ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <td className="py-1.5 px-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleRow(tx.id)}
                            className="text-slate-400 hover:text-slate-700"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-blue-950" />
                            ) : (
                              <Square className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                        <td className="py-1.5 px-2 font-mono font-medium text-blue-950">
                          {tx.ref || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-1.5 px-2 font-mono text-slate-700">{tx.orderNumber}</td>
                        <td className="py-1.5 px-2 text-right font-medium text-slate-900">
                          {fmtNumber(tx.amount)}
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-500">
                          {fmtNumber(tx.fee)}
                        </td>
                        <td className="py-1.5 px-2 font-mono text-slate-500">{tx.phoneNumber}</td>
                        <td className="py-1.5 px-2">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[13px] font-medium border ${statusBadge(
                              tx.status
                            )}`}
                          >
                            {tx.status === 'Success' && <Check className="w-2.5 h-2.5" />}
                            {tx.status === 'Failed' && <X className="w-2.5 h-2.5" />}
                            {tx.status === 'Pending' && <Clock className="w-2.5 h-2.5" />}
                            {tx.status === 'Reversed' && <RefreshCw className="w-2.5 h-2.5" />}
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-1.5 px-2">
                          <span className="font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[13px]">
                            {tx.responseCode || '—'}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 font-mono text-slate-400 text-[13px]">{tx.date}</td>
                        <td className="py-1.5 px-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => setActiveTx(tx)}
                              title="View"
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {tx.status === 'Failed' && tx.method === 'MPESA' && (
                              <button
                                onClick={() => handleRetry(tx)}
                                disabled={busy}
                                title="Retry"
                                className="p-1 rounded bg-blue-950 hover:bg-blue-900 disabled:opacity-50 text-white transition"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setReconcileTx(tx);
                                setReconcileOrder(tx.orderNumber);
                                setReconcileStatus('Matched');
                                setReconcileNote('');
                              }}
                              title="Reconcile"
                              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-medium transition text-[13px]"
                            >
                              Reconcile
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

      {activeTx && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end"
          onClick={() => setActiveTx(null)}
        >
          <div
            className="bg-white border-l border-slate-200 w-full max-w-xl h-full flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-2 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-500">Transaction inspector</p>
                <h2 className="text-[13px] font-semibold font-mono text-blue-950 mt-0.5 truncate">
                  {activeTx.ref || activeTx.id}
                </h2>
              </div>
              <button
                onClick={() => setActiveTx(null)}
                className="h-7 w-7 rounded hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2 text-[13px]">
              <div className="grid grid-cols-2 gap-1.5">
                <Stat label="Order linked" value={activeTx.orderNumber} mono icon={<Link2 className="w-3 h-3" />} />
                <Stat label="Amount" value={fmtMoney(activeTx.amount)} icon={<DollarSign className="w-3 h-3" />} />
                <Stat label="Gateway fee" value={fmtMoney(activeTx.fee)} />
                <Stat label="Response code" value={activeTx.responseCode || '—'} mono />
                <Stat label="Customer" value={activeTx.customerName} icon={<User className="w-3 h-3" />} />
                <Stat label="Phone" value={activeTx.phoneNumber} mono icon={<Phone className="w-3 h-3" />} />
                <Stat label="Merchant Request ID" value={activeTx.merchantRequestId || '—'} mono />
                <Stat label="Checkout Request ID" value={activeTx.checkoutRequestId || '—'} mono />
              </div>

              <div
                className={`rounded p-2 border ${
                  activeTx.status === 'Success'
                    ? 'bg-emerald-50 border-emerald-200'
                    : activeTx.status === 'Failed'
                      ? 'bg-red-50 border-red-200'
                      : activeTx.status === 'Reversed'
                        ? 'bg-purple-50 border-purple-200'
                        : 'bg-amber-50 border-amber-200'
                }`}
              >
                <p className="font-medium text-slate-700 mb-0.5 text-[13px]">Result description</p>
                <p className="text-slate-800 text-[13px]">{activeTx.responseDesc || '—'}</p>
              </div>

              <div>
                <p className="font-medium text-slate-700 mb-1.5 text-[13px]">Lifecycle timeline</p>
                {activeTx.timeline.length === 0 ? (
                  <p className="text-slate-400 text-[13px]">No events recorded.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {activeTx.timeline.map((item, idx) => {
                      const dot =
                        item.status === 'completed'
                          ? 'bg-emerald-500'
                          : item.status === 'failed'
                            ? 'bg-red-500'
                            : 'bg-amber-500';
                      return (
                        <li
                          key={idx}
                          className="bg-slate-50 border border-slate-200 rounded p-2 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                            <span className="font-medium text-slate-800 truncate text-[13px]">{item.title}</span>
                          </div>
                          <span className="font-mono text-slate-400 shrink-0 text-[13px]">{item.time}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="font-medium text-slate-700 text-[13px]">Raw gateway callback payload</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(activeTx.payload, null, 2));
                      setToastMessage('Copied JSON');
                    }}
                    className="text-blue-950 hover:underline font-medium inline-flex items-center gap-1 text-[13px]"
                  >
                    <Copy className="w-3 h-3" />
                    Copy JSON
                  </button>
                </div>
                <div className="bg-slate-900 text-slate-100 p-2.5 rounded font-mono text-[13px] overflow-x-auto">
                  <pre>{JSON.stringify(activeTx.payload ?? {}, null, 2)}</pre>
                </div>
              </div>
            </div>

            <div className="px-2 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-1.5 shrink-0">
              <button
                onClick={() => {
                  setReconcileTx(activeTx);
                  setReconcileOrder(activeTx.orderNumber);
                  setReconcileStatus('Matched');
                  setReconcileNote('');
                  setActiveTx(null);
                }}
                className="bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-700 font-medium px-2.5 py-1.5 rounded text-[13px]"
              >
                Reconcile
              </button>
              {activeTx.status === 'Failed' && activeTx.method === 'MPESA' && (
                <button
                  onClick={() => handleRetry(activeTx)}
                  disabled={busy}
                  className="bg-blue-950 hover:bg-blue-900 disabled:opacity-50 text-white font-medium px-2.5 py-1.5 rounded text-[13px] inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry payment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {reconcileTx && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setReconcileTx(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded max-w-md w-full p-2 shadow-xl space-y-2 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-500">Manual reconciliation</p>
                <h3 className="text-[13px] font-semibold font-mono text-slate-900 mt-0.5 truncate">
                  {reconcileTx.ref || reconcileTx.id}
                </h3>
              </div>
              <button
                onClick={() => setReconcileTx(null)}
                className="h-7 w-7 rounded hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded p-2 flex items-center justify-between gap-2 text-[13px]">
              <div>
                <p className="text-slate-500">Amount</p>
                <p className="font-medium text-slate-900">{fmtMoney(reconcileTx.amount)}</p>
              </div>
              <div>
                <p className="text-slate-500">Phone</p>
                <p className="font-mono font-medium text-slate-900">{reconcileTx.phoneNumber}</p>
              </div>
              <div>
                <p className="text-slate-500">Date</p>
                <p className="font-mono font-medium text-slate-900">{reconcileTx.date}</p>
              </div>
            </div>

            <div>
              <p className="font-medium text-slate-700 mb-1 text-[13px]">Reconciliation status</p>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setReconcileStatus('Matched')}
                  className={`py-1.5 rounded font-medium border transition text-[13px] ${
                    reconcileStatus === 'Matched'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Mark matched
                </button>
                <button
                  type="button"
                  onClick={() => setReconcileStatus('Unmatched')}
                  className={`py-1.5 rounded-md font-medium border transition text-[13px] ${
                    reconcileStatus === 'Unmatched'
                      ? 'bg-red-50 text-red-700 border-red-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Mark unmatched
                </button>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1 text-[13px]">Attach to order</label>
              <input
                type="text"
                value={reconcileOrder}
                onChange={(e) => setReconcileOrder(e.target.value)}
                placeholder="ORD-YYYYMMDD-XXXXXXXX"
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1 text-[13px]">Audit note</label>
              <textarea
                rows={3}
                value={reconcileNote}
                onChange={(e) => setReconcileNote(e.target.value)}
                placeholder="Explain manual match or discrepancy…"
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

            <div className="flex justify-end gap-1.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setReconcileTx(null)}
                disabled={busy}
                className="bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-medium px-2.5 py-1.5 rounded text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={saveReconciliation}
                disabled={busy}
                className="bg-blue-950 hover:bg-blue-900 disabled:opacity-50 text-white font-medium px-2.5 py-1.5 rounded text-[13px]"
              >
                {busy ? 'Saving…' : 'Save reconciliation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
        className={`flex items-center gap-1 border rounded px-2.5 py-1.5 text-[13px] font-medium transition whitespace-nowrap ${
          isActive
            ? 'bg-blue-50 border-blue-950 text-blue-950'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
        }`}
      >
        {value ?? label}
        <ChevronDown className={`w-3 h-3 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 w-52 rounded border border-slate-200 bg-white shadow-lg z-50 p-1">
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`w-full text-left px-2 py-1.5 rounded text-[13px] ${
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
                className={`w-full text-left px-2 py-1.5 rounded text-[13px] flex items-center justify-between ${
                  selected ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{opt}</span>
                {selected && <Check className="w-3 h-3" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
  icon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-2">
      <p className="text-[13px] font-medium text-slate-500 flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className={`text-[13px] font-semibold text-slate-900 mt-0.5 truncate ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  );
}
