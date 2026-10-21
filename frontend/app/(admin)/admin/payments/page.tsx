'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Smartphone,
  Check,
  X,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

import { adminApi } from '@/lib/admin-api';
import type {
  AdminPaymentConfig,
  AdminPaymentSummary,
  AdminTransaction,
} from '@/lib/admin-types';

const SPARKLINE_DATA = [
  { v: 40 }, { v: 65 }, { v: 45 }, { v: 80 },
  { v: 70 }, { v: 95 }, { v: 100 },
];

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

  const totalVolume = toNum(summary?.total_volume);
  const totalRefunded = payments
    .filter((p) => p.status === 'Reversed')
    .reduce((acc, p) => acc + toNum(p.amount), 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-2 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-2 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Payments</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              M-Pesa payment provider & transaction records
            </p>
          </div>
          <button
            onClick={() => void loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] transition disabled:opacity-50"
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
          <div className="bg-red-50 border border-red-100 rounded-sm px-3 py-2 flex items-center justify-between gap-2">
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
          <div className="bg-white border border-slate-200 rounded-sm py-16 flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            <p className="text-[13px] text-slate-500">Loading payments…</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-sm p-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                      <Smartphone className="w-6 h-6" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-slate-900">
                        Safaricom M-Pesa STK Push
                      </p>
                      <p className="text-[13px] text-slate-500 mt-0.5">
                        Instant mobile money checkout for Kenyan customers
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className={`text-[13px] font-medium px-2 py-0.5 rounded-sm border ${config?.enabled
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                        >
                          {config?.enabled ? 'Connected' : 'Disabled'}
                        </span>
                        <span
                          className={`text-[13px] font-medium px-2 py-0.5 rounded-sm border ${config?.environment === 'production'
                              ? 'bg-purple-50 text-purple-700 border-purple-100'
                              : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}
                        >
                          {config?.environment === 'production' ? 'Production' : 'Sandbox'}
                        </span>
                        <span className="text-[13px] font-mono text-slate-500">
                          Shortcode {config?.shortcode || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-1 pt-1 border-t border-slate-100">
                  <div>
                    <p className="text-[13px] text-slate-500">Today's volume</p>
                    <p className="text-[15px] font-bold text-slate-900 mt-0.5">
                      {fmtKES(summary?.today_volume)}
                    </p>
                    <p className="text-[13px] text-emerald-600 inline-flex items-center gap-0.5 mt-0.5">
                      <ArrowUpRight className="w-3 h-3" /> Live
                    </p>
                  </div>
                  <div>
                    <p className="text-[13px] text-slate-500">Success rate</p>
                    <p className="text-[15px] font-bold text-emerald-600 mt-0.5">
                      {summary?.success_rate ?? 0}%
                    </p>
                    <p className="text-[13px] text-slate-500 mt-0.5">All time</p>
                  </div>
                  <div>
                    <p className="text-[13px] text-slate-500">Callback URL</p>
                    <p className="text-[13px] font-mono text-blue-950 mt-0.5 truncate">
                      {config?.callback_url || '—'}
                    </p>
                  </div>
                </div>

                <div className="h-12 w-full mt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={SPARKLINE_DATA}>
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke="#059669"
                        fill="#10b981"
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-sm p-2">
                <p className="text-[13px] font-medium text-slate-500">Successful volume</p>
                <p className="text-[15px] font-bold text-slate-900 mt-0.5">
                  {fmtKES(totalVolume)}
                </p>
                <p className="text-[13px] text-emerald-600 mt-0.5 inline-flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> System verified
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-sm p-2">
                <p className="text-[13px] font-medium text-slate-500">Reversed</p>
                <p className="text-[15px] font-bold text-slate-900 mt-0.5">
                  {fmtKES(totalRefunded)}
                </p>
                <p className="text-[13px] text-purple-600 mt-0.5">Reversed via M-Pesa</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="bg-white border border-slate-200 rounded-sm p-2">
                <p className="text-[13px] font-medium text-slate-500">Total records</p>
                <p className="text-[15px] font-bold text-slate-900 mt-0.5">
                  {summary?.total_records ?? payments.length}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-sm p-2">
                <p className="text-[13px] font-medium text-slate-500">Pending</p>
                <p className="text-[15px] font-bold text-amber-600 mt-0.5">
                  {summary?.pending_count ?? 0}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-sm p-2">
                <p className="text-[13px] font-medium text-slate-500">Failed</p>
                <p className="text-[15px] font-bold text-red-600 mt-0.5">
                  {summary?.failed_count ?? 0}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-sm p-2">
                <p className="text-[13px] font-medium text-slate-500">Reversed</p>
                <p className="text-[15px] font-bold text-purple-600 mt-0.5">
                  {payments.filter((p) => p.status === 'Reversed').length}
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-slate-900">
                    M-Pesa payment records
                  </p>
                  <p className="text-[13px] text-slate-500">
                    System-verified financial events linked to orders
                  </p>
                </div>
                <span className="text-[13px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-sm">
                  {payments.length}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-2 font-medium">Payment method</th>
                      <th className="py-2 px-2 font-medium">Provider reference</th>
                      <th className="py-2 px-2 font-medium">Order</th>
                      <th className="py-2 px-2 font-medium">Customer</th>
                      <th className="py-2 px-2 font-medium text-right">Amount</th>
                      <th className="py-2 px-2 font-medium">Fee</th>
                      <th className="py-2 px-2 font-medium">Status</th>
                      <th className="py-2 px-2 font-medium">Date</th>
                      <th className="py-2 px-2 w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="py-12 text-center text-slate-400 text-[13px]"
                        >
                          No payment records yet.
                        </td>
                      </tr>
                    ) : (
                      payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm font-medium border ${p.method === 'MPESA'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : 'bg-slate-50 text-slate-600 border-slate-200'
                                }`}
                            >
                              {p.method === 'MPESA' && <Smartphone className="w-3 h-3" />}
                              {p.method === 'MPESA' ? 'M-Pesa' : 'Cash on delivery'}
                            </span>
                          </td>
                          <td className="py-2 px-2 font-mono font-medium text-blue-950">
                            {p.ref || '—'}
                          </td>
                          <td className="py-2 px-2 font-mono text-slate-700">
                            {p.orderNumber || '—'}
                          </td>
                          <td className="py-2 px-2">
                            <p className="font-medium text-slate-900 truncate max-w-[160px]">
                              {p.customerName || '—'}
                            </p>
                            <p className="text-[13px] text-slate-400 font-mono">
                              {p.phoneNumber || '—'}
                            </p>
                          </td>
                          <td className="py-2 px-2 text-right font-medium text-slate-900 tabular-nums">
                            {fmtKES(p.amount)}
                          </td>
                          <td className="py-2 px-2 text-slate-600 tabular-nums">
                            {fmtKES(p.fee)}
                          </td>
                          <td className="py-2 px-2">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border ${statusBadge(
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
                          <td className="py-2 px-2 font-mono text-slate-400 whitespace-nowrap">
                            {p.date || '—'}
                          </td>
                          <td className="py-2 px-2">
                            {p.status === 'Success' ? (
                              <button
                                onClick={() => goToReturns(p.orderNumber)}
                                className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 py-2 rounded-sm font-medium text-[13px] transition"
                                title="Refunds are handled from the Returns page"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Refund
                              </button>
                            ) : (
                              <span className="text-slate-400">—</span>
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