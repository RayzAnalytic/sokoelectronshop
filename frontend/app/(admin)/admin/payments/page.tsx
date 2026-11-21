'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Smartphone,
  Check,
  X,
  RefreshCw,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

import { adminApi } from '@/lib/admin-api';
import type {
  AdminPaymentConfig,
  AdminPaymentSummary,
  AdminTransaction,
} from '@/lib/admin-types';

function toNum(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmtKES(value: string | number | null | undefined): string {
  const n = toNum(value);
  return `KES ${n.toLocaleString('en-KE')}`;
}

export default function PaymentsOverviewPage() {
  const router = useRouter();

  const [config, setConfig] = useState<AdminPaymentConfig | null>(null);
  const [summary, setSummary] = useState<AdminPaymentSummary | null>(null);
  const [payments, setPayments] = useState<AdminTransaction[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfg, sum, tx] = await Promise.all([
        adminApi.payments.config.get(),
        adminApi.payments.summary(),
        adminApi.payments.transactions.list({ limit: 200 }),
      ]);
      setConfig(cfg);
      setSummary(sum);
      setPayments(tx);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load payments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const goToReturns = (orderNumber: string) => {
    router.push(`/admin/returnsrefunds?order=${encodeURIComponent(orderNumber)}`);
  };

  const statusBadge = (s: AdminTransaction['status']) =>
    s === 'Success'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'Failed'
        ? 'bg-red-50 text-red-600 border-red-100'
        : s === 'Reversed'
          ? 'bg-purple-50 text-purple-700 border-purple-100'
          : 'bg-amber-50 text-amber-700 border-amber-100';

  const failedCount = summary?.failed_count ?? 0;
  const pendingCount = summary?.pending_count ?? 0;
  const reversedCount = payments.filter((p) => p.status === 'Reversed').length;
  const needsAttention = failedCount + pendingCount;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1700px] mx-auto px-2 py-3 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Payments</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Track M-Pesa payments from your customers
            </p>
          </div>
          <button
            onClick={() => void loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded text-[13px] transition disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>Refresh</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1700px] mx-auto px-0.5 py-3 space-y-2">

        {error && (
          <div className="bg-red-50 border border-red-100 rounded px-2 py-2 flex items-center justify-between gap-2">
            <span className="text-[13px] text-red-700">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white border border-slate-200 rounded py-16 flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            <p className="text-[13px] text-slate-500">Loading payments…</p>
          </div>
        ) : (
          <>
            <div className="bg-white border border-slate-200 rounded p-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[15px] font-semibold text-slate-900">
                      M-Pesa payments
                    </p>
                    <span
                      className={`text-[12px] font-medium px-2 py-0.5 rounded border ${config?.enabled
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                    >
                      {config?.enabled ? 'Live' : 'Not active'}
                    </span>
                    {config?.shortcode && (
                      <span className="text-[12px] text-slate-400 font-mono">
                        · Till {config.shortcode}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-slate-500 mt-0.5">
                    {config?.enabled
                      ? 'Customers can pay you instantly through M-Pesa.'
                      : 'Payments are currently turned off.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100">
                <div>
                  <p className="text-[12px] text-slate-500 uppercase font-medium">Today</p>
                  <p className="text-[16px] font-bold text-slate-900 mt-0.5">
                    {fmtKES(summary?.today_volume)}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-slate-500 uppercase font-medium">Success rate</p>
                  <p className="text-[16px] font-bold text-emerald-600 mt-0.5">
                    {summary?.success_rate ?? 0}%
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-slate-500 uppercase font-medium">Total collected</p>
                  <p className="text-[16px] font-bold text-slate-900 mt-0.5">
                    {fmtKES(summary?.total_volume)}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-slate-500 uppercase font-medium">Refunded</p>
                  <p className="text-[16px] font-bold text-slate-900 mt-0.5">
                    {reversedCount > 0 ? reversedCount : '—'}
                  </p>
                </div>
              </div>
            </div>

            {needsAttention > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded p-2 flex items-center gap-2 text-[13px] text-amber-900">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {failedCount > 0 && `${failedCount} failed`}
                  {failedCount > 0 && pendingCount > 0 && ' and '}
                  {pendingCount > 0 && `${pendingCount} pending`}
                  {' '}payment{needsAttention !== 1 ? 's' : ''} need{needsAttention === 1 ? 's' : ''} attention
                </span>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-slate-900">
                  Payment history
                </p>
                <span className="text-[13px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                  {payments.length}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-3 font-medium">Order</th>
                      <th className="py-2 px-3 font-medium">Customer</th>
                      <th className="py-2 px-3 font-medium text-right">Amount</th>
                      <th className="py-2 px-3 font-medium">Status</th>
                      <th className="py-2 px-3 font-medium">Date</th>
                      <th className="py-2 px-3 w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 text-[13px]">
                          No payments yet. They will appear here as customers pay.
                        </td>
                      </tr>
                    ) : (
                      payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 font-mono text-slate-700">
                            {p.orderNumber || '—'}
                          </td>
                          <td className="py-2 px-3">
                            <p className="font-medium text-slate-900 truncate max-w-[180px]">
                              {p.customerName || '—'}
                            </p>
                            {p.phoneNumber && (
                              <p className="text-[12px] text-slate-400 font-mono">
                                {p.phoneNumber}
                              </p>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-slate-900 tabular-nums">
                            {fmtKES(p.amount)}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium border ${statusBadge(
                                p.status
                              )}`}
                            >
                              {p.status === 'Success' && <Check className="w-3 h-3" />}
                              {p.status === 'Failed' && <X className="w-3 h-3" />}
                              {p.status === 'Pending' && <RefreshCw className="w-3 h-3" />}
                              {p.status === 'Reversed' && <RefreshCw className="w-3 h-3" />}
                              {p.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-400 whitespace-nowrap text-[12px]">
                            {p.date || '—'}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {p.status === 'Success' ? (
                              <button
                                onClick={() => goToReturns(p.orderNumber)}
                                className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 py-1.5 rounded font-medium text-[12px] transition"
                                title="Issue a refund"
                              >
                                <RefreshCw className="w-3 h-3" />
                                Refund
                              </button>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}