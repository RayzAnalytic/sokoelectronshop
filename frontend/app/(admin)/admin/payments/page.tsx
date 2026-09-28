'use client';

import React, { useEffect, useState } from 'react';
import {
  Smartphone,
  Settings,
  Check,
  X,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  ArrowUpRight,
  AlertTriangle,
  Ban,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

// --- TYPES ---
// M-Pesa is the ONLY payment method.
// The backend MUST verify every M-Pesa callback before marking a payment as successful.

type MpesaStatus = 'Enabled' | 'Disabled';
type MpesaMode = 'Production' | 'Sandbox';

type PaymentStatus = 'Success' | 'Pending' | 'Failed' | 'Reversed';
type RefundStatus = 'None' | 'Requested' | 'Processing' | 'Refunded' | 'Rejected';

interface MpesaConfig {
  status: MpesaStatus;
  mode: MpesaMode;
  todayVolume: number;
  successRate: number;
  credentials: {
    consumerKey: string;
    consumerSecret: string;
    passkey: string;
    shortcode: string;
    callbackUrl: string;
    environment: string;
  };
}

interface PaymentRecord {
  id: string;
  mpesaRef: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  refundStatus: RefundStatus;
  failureReason?: string;
  date: string;
  verifiedByBackend: boolean;
}

const INITIAL_MPESA: MpesaConfig = {
  status: 'Enabled',
  mode: 'Production',
  todayVolume: 142500,
  successRate: 98.4,
  credentials: {
    consumerKey: 'saf_live_9a87bc6543210fedcba',
    consumerSecret: 'sec_live_fedcba0123456789abcd',
    passkey: 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
    shortcode: '174379',
    callbackUrl: 'https://api.sokoflow.co.ke/v1/payments/mpesa/callback/',
    environment: 'Production',
  },
};

const INITIAL_PAYMENTS: PaymentRecord[] = [
  {
    id: 'pay-1',
    mpesaRef: 'MPX9842K21',
    orderNumber: '#SKO-9842',
    customerName: 'Brian Kiprop',
    customerPhone: '+254 712 *** 890',
    amount: 157500,
    currency: 'KES',
    status: 'Success',
    refundStatus: 'None',
    date: '2026-09-23 21:14',
    verifiedByBackend: true,
  },
  {
    id: 'pay-2',
    mpesaRef: 'MPX9843B77',
    orderNumber: '#SKO-9843',
    customerName: 'Amina Ouma',
    customerPhone: '+254 733 *** 654',
    amount: 68000,
    currency: 'KES',
    status: 'Success',
    refundStatus: 'None',
    date: '2026-09-23 20:42',
    verifiedByBackend: true,
  },
  {
    id: 'pay-3',
    mpesaRef: 'MPX9840C12',
    orderNumber: '#SKO-9840',
    customerName: 'Kevin Juma',
    customerPhone: '+254 733 *** 112',
    amount: 14500,
    currency: 'KES',
    status: 'Failed',
    refundStatus: 'None',
    failureReason: 'Request cancelled by user (1032)',
    date: '2026-09-23 19:10',
    verifiedByBackend: true,
  },
  {
    id: 'pay-4',
    mpesaRef: 'MPX9839A10',
    orderNumber: '#SKO-9839',
    customerName: 'Sarah Wanjiru',
    customerPhone: '+254 722 *** 445',
    amount: 32000,
    currency: 'KES',
    status: 'Success',
    refundStatus: 'None',
    date: '2026-09-23 18:05',
    verifiedByBackend: true,
  },
  {
    id: 'pay-5',
    mpesaRef: 'MPX9835D55',
    orderNumber: '#SKO-9835',
    customerName: 'David Mutua',
    customerPhone: '+254 701 *** 223',
    amount: 8900,
    currency: 'KES',
    status: 'Success',
    refundStatus: 'Refunded',
    date: '2026-09-23 16:30',
    verifiedByBackend: true,
  },
  {
    id: 'pay-6',
    mpesaRef: 'MPX9831B99',
    orderNumber: '#SKO-9831',
    customerName: 'Mercy Chebet',
    customerPhone: '+254 700 *** 991',
    amount: 45000,
    currency: 'KES',
    status: 'Failed',
    refundStatus: 'None',
    failureReason: 'Insufficient funds (1001)',
    date: '2026-09-23 14:22',
    verifiedByBackend: true,
  },
  {
    id: 'pay-7',
    mpesaRef: 'MPX9828E33',
    orderNumber: '#SKO-9828',
    customerName: 'John Omondi',
    customerPhone: '+254 711 *** 007',
    amount: 24000,
    currency: 'KES',
    status: 'Success',
    refundStatus: 'Requested',
    date: '2026-09-23 13:12',
    verifiedByBackend: true,
  },
  {
    id: 'pay-8',
    mpesaRef: 'MPX9820REV',
    orderNumber: '#SKO-9815',
    customerName: 'Grace Njeri',
    customerPhone: '+254 722 *** 102',
    amount: 120000,
    currency: 'KES',
    status: 'Reversed',
    refundStatus: 'Refunded',
    date: '2026-09-22 10:15',
    verifiedByBackend: true,
  },
];

const SPARKLINE_DATA = [
  { v: 40 }, { v: 65 }, { v: 45 }, { v: 80 },
  { v: 70 }, { v: 95 }, { v: 100 },
];

export default function PaymentsOverviewPage() {
  const [mpesa, setMpesa] = useState<MpesaConfig>(INITIAL_MPESA);
  const [payments, setPayments] = useState<PaymentRecord[]>(INITIAL_PAYMENTS);

  const [configOpen, setConfigOpen] = useState(false);
  const [tempCredentials, setTempCredentials] = useState<Record<string, string>>({});
  const [showPasswordFields, setShowPasswordFields] = useState<Record<string, boolean>>({});

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (!configOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfigOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [configOpen]);

  const openConfigure = () => {
    setConfigOpen(true);
    setTempCredentials({ ...mpesa.credentials });
    setShowPasswordFields({});
  };

  const saveCredentials = () => {
    setMpesa((prev) => ({ ...prev, credentials: { ...tempCredentials } }));
    setConfigOpen(false);
    setToastMessage('M-Pesa configuration saved');
  };

  const toggleStatus = () => {
    setMpesa((prev) => ({
      ...prev,
      status: prev.status === 'Enabled' ? 'Disabled' : 'Enabled',
    }));
    setToastMessage('M-Pesa status updated');
  };

  const testConnection = () => {
    setIsTesting(true);
    setTimeout(() => {
      setIsTesting(false);
      setToastMessage('M-Pesa connection test passed');
    }, 1100);
  };

  const markRefund = (id: string, orderNum: string) => {
    setPayments((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, refundStatus: 'Refunded', status: 'Reversed' } : p
      )
    );
    setToastMessage(`Refund processed for ${orderNum}`);
  };

  const statusBadge = (s: PaymentStatus) =>
    s === 'Success'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'Failed'
        ? 'bg-red-50 text-red-600 border-red-100'
        : s === 'Reversed'
          ? 'bg-purple-50 text-purple-700 border-purple-100'
          : 'bg-amber-50 text-amber-700 border-amber-100';

  const refundBadge = (r: RefundStatus) =>
    r === 'Refunded'
      ? 'bg-purple-50 text-purple-700 border-purple-100'
      : r === 'Requested'
        ? 'bg-amber-50 text-amber-700 border-amber-100'
        : r === 'Processing'
          ? 'bg-blue-50 text-blue-950 border-blue-100'
          : r === 'Rejected'
            ? 'bg-red-50 text-red-600 border-red-100'
            : 'bg-slate-50 text-slate-600 border-slate-200';

  const totalVolume = payments
    .filter((p) => p.status === 'Success')
    .reduce((a, p) => a + p.amount, 0);
  const totalRefunded = payments
    .filter((p) => p.refundStatus === 'Refunded')
    .reduce((a, p) => a + p.amount, 0);
  const pendingCount = payments.filter((p) => p.status === 'Pending').length;
  const failedCount = payments.filter((p) => p.status === 'Failed').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
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
            <h1 className="text-[15px] font-semibold text-slate-900">Payments</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              M-Pesa payment provider & transaction records
            </p>
          </div>
          <button
            onClick={openConfigure}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configure M-Pesa</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* BACKEND TRUST BANNER */}
        <div className="bg-amber-50 border border-amber-200 rounded-sm p-2 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-[13px]">
            <p className="font-medium text-amber-800">Backend verification required</p>
            <p className="text-amber-700 mt-0.5">
              Never trust the frontend alone to mark payments as successful. Every M-Pesa
              callback/webhook must be verified by your backend against Safaricom's servers before
              the order is marked Paid. The records below reflect backend-confirmed states only.
            </p>
          </div>
        </div>

        {/* PROVIDER STATUS */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-sm p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-12 h-12 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                  <Smartphone className="w-6 h-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-slate-900">
                    Safaricom M-Pesa STK Push
                  </p>
                  <p className="text-[13px] text-slate-500 mt-0.5">
                    Instant mobile money checkout for Kenyan customers
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span
                      className={`text-[13px] font-medium px-2 py-0.5 rounded-sm border ${mpesa.status === 'Enabled'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                    >
                      {mpesa.status === 'Enabled' ? 'Connected' : 'Disabled'}
                    </span>
                    <span
                      className={`text-[13px] font-medium px-2 py-0.5 rounded-sm border ${mpesa.mode === 'Production'
                          ? 'bg-purple-50 text-purple-700 border-purple-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}
                    >
                      {mpesa.mode}
                    </span>
                    <span className="text-[13px] font-mono text-slate-500">
                      Shortcode {mpesa.credentials.shortcode}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={toggleStatus}
                  className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] transition"
                >
                  {mpesa.status === 'Enabled' ? <Ban className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                  {mpesa.status === 'Enabled' ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={openConfigure}
                  className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-blue-950 hover:border-blue-950 hover:text-white text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] transition"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Configure
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100">
              <div>
                <p className="text-[13px] text-slate-500">Today's volume</p>
                <p className="text-[15px] font-bold text-slate-900 mt-0.5">
                  KES {mpesa.todayVolume.toLocaleString()}
                </p>
                <p className="text-[13px] text-emerald-600 inline-flex items-center gap-0.5 mt-0.5">
                  <ArrowUpRight className="w-3 h-3" /> +14%
                </p>
              </div>
              <div>
                <p className="text-[13px] text-slate-500">Success rate</p>
                <p className="text-[15px] font-bold text-emerald-600 mt-0.5">
                  {mpesa.successRate}%
                </p>
                <p className="text-[13px] text-slate-500 mt-0.5">Last 24 hours</p>
              </div>
              <div>
                <p className="text-[13px] text-slate-500">Callback URL</p>
                <p className="text-[13px] font-mono text-blue-950 mt-0.5 truncate">
                  {mpesa.credentials.callbackUrl}
                </p>
              </div>
            </div>

            <div className="h-12 w-full mt-2">
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
              KES {totalVolume.toLocaleString()}
            </p>
            <p className="text-[13px] text-emerald-600 mt-0.5 inline-flex items-center gap-0.5">
              <CheckCircle2 className="w-3 h-3" /> Backend verified
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2">
            <p className="text-[13px] font-medium text-slate-500">Refunded</p>
            <p className="text-[15px] font-bold text-slate-900 mt-0.5">
              KES {totalRefunded.toLocaleString()}
            </p>
            <p className="text-[13px] text-purple-600 mt-0.5">Reversed via M-Pesa</p>
          </div>
        </div>

        {/* QUICK STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="bg-white border border-slate-200 rounded-sm p-2">
            <p className="text-[13px] font-medium text-slate-500">Total records</p>
            <p className="text-[15px] font-bold text-slate-900 mt-0.5">{payments.length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-sm p-2">
            <p className="text-[13px] font-medium text-slate-500">Pending</p>
            <p className="text-[15px] font-bold text-amber-600 mt-0.5">{pendingCount}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-sm p-2">
            <p className="text-[13px] font-medium text-slate-500">Failed</p>
            <p className="text-[15px] font-bold text-red-600 mt-0.5">{failedCount}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-sm p-2">
            <p className="text-[13px] font-medium text-slate-500">Refund requests</p>
            <p className="text-[15px] font-bold text-purple-600 mt-0.5">
              {payments.filter((p) => p.refundStatus === 'Requested').length}
            </p>
          </div>
        </div>

        {/* PAYMENT RECORDS TABLE */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-slate-900">M-Pesa payment records</p>
              <p className="text-[13px] text-slate-500">
                Backend-verified financial events linked to orders
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
                  <th className="py-2 px-3 font-medium">Payment method</th>
                  <th className="py-2 px-3 font-medium">Provider reference</th>
                  <th className="py-2 px-3 font-medium">Order</th>
                  <th className="py-2 px-3 font-medium">Customer</th>
                  <th className="py-2 px-3 font-medium text-right">Amount</th>
                  <th className="py-2 px-3 font-medium">Currency</th>
                  <th className="py-2 px-3 font-medium">Payment status</th>
                  <th className="py-2 px-3 font-medium">Refund status</th>
                  <th className="py-2 px-3 font-medium">Date</th>
                  <th className="py-2 px-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 text-[13px]">
                      No payment records yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm font-medium border bg-emerald-50 text-emerald-700 border-emerald-100">
                          <Smartphone className="w-3 h-3" />
                          M-Pesa
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono font-medium text-blue-950">
                        {p.mpesaRef}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-700">{p.orderNumber}</td>
                      <td className="py-2 px-3">
                        <p className="font-medium text-slate-900 truncate max-w-[160px]">
                          {p.customerName}
                        </p>
                        <p className="text-[13px] text-slate-400 font-mono">
                          {p.customerPhone}
                        </p>
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-slate-900">
                        {p.amount.toLocaleString()}
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-mono text-slate-600">{p.currency}</span>
                      </td>
                      <td className="py-2 px-3">
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
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${refundBadge(
                            p.refundStatus
                          )}`}
                        >
                          {p.refundStatus}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-400">{p.date}</td>
                      <td className="py-2 px-3">
                        {p.status === 'Success' && p.refundStatus !== 'Refunded' ? (
                          <button
                            onClick={() => markRefund(p.id, p.orderNumber)}
                            className="inline-flex items-center gap-1 bg-white border border-red-200 hover:bg-red-50 text-red-600 px-2.5 py-2 rounded-sm font-medium text-[13px] transition"
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
      </main>

      {/* CONFIGURE MODAL */}
      {configOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setConfigOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 h-4" />
                </span>
                <p className="text-[15px] font-semibold text-slate-900 truncate">
                  Configure M-Pesa
                </p>
              </div>
              <button
                onClick={() => setConfigOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
              <SecretField
                label="Consumer key"
                value={tempCredentials.consumerKey || ''}
                onChange={(v) => setTempCredentials({ ...tempCredentials, consumerKey: v })}
                show={!!showPasswordFields.consumerKey}
                onToggle={() =>
                  setShowPasswordFields((p) => ({ ...p, consumerKey: !p.consumerKey }))
                }
              />
              <SecretField
                label="Consumer secret"
                value={tempCredentials.consumerSecret || ''}
                onChange={(v) => setTempCredentials({ ...tempCredentials, consumerSecret: v })}
                show={!!showPasswordFields.consumerSecret}
                onToggle={() =>
                  setShowPasswordFields((p) => ({ ...p, consumerSecret: !p.consumerSecret }))
                }
              />
              <SecretField
                label="Passkey"
                value={tempCredentials.passkey || ''}
                onChange={(v) => setTempCredentials({ ...tempCredentials, passkey: v })}
                show={!!showPasswordFields.passkey}
                onToggle={() => setShowPasswordFields((p) => ({ ...p, passkey: !p.passkey }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Shortcode"
                  value={tempCredentials.shortcode || ''}
                  onChange={(v) => setTempCredentials({ ...tempCredentials, shortcode: v })}
                  mono
                />
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Environment</label>
                  <select
                    value={tempCredentials.environment || 'Production'}
                    onChange={(e) =>
                      setTempCredentials({ ...tempCredentials, environment: e.target.value })
                    }
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  >
                    <option value="Production">Production</option>
                    <option value="Sandbox">Sandbox</option>
                  </select>
                </div>
              </div>
              <Field
                label="Callback URL"
                value={tempCredentials.callbackUrl || ''}
                onChange={(v) => setTempCredentials({ ...tempCredentials, callbackUrl: v })}
                mono
              />

              <div className="bg-amber-50 border border-amber-200 rounded-sm p-2 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="text-amber-700 text-[13px]">
                  Callback URL must be publicly reachable and validated by your backend. Never
                  trust client-side success indicators.
                </p>
              </div>
            </div>

            <div className="px-3 py-2 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <button
                onClick={testConnection}
                disabled={isTesting}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
              >
                {isTesting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                )}
                {isTesting ? 'Testing…' : 'Test connection'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfigOpen(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCredentials}
                  className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Field ---------- */
function Field({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="block font-medium text-slate-700 mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 ${mono ? 'font-mono' : ''
          }`}
      />
    </label>
  );
}

/* ---------- SecretField ---------- */
function SecretField({
  label,
  value,
  onChange,
  show,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="block">
      <span className="block font-medium text-slate-700 mb-1">{label}</span>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 pr-9 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-400"
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    </label>
  );
}