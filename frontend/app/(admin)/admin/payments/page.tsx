'use client';

import React, { useEffect, useState } from 'react';
import {
  DollarSign,
  CreditCard,
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
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

// --- TYPES ---
type GatewayId = 'mpesa' | 'airtel' | 'stripe' | 'cod';
type GatewayStatus = 'Enabled' | 'Disabled';
type GatewayMode = 'Production' | 'Live' | 'Test';

interface GatewayConfig {
  id: GatewayId;
  name: string;
  description: string;
  logoBg: string;
  status: GatewayStatus;
  mode: GatewayMode;
  todayVolume: number;
  successRate: number;
  credentials: Record<string, string>;
}

interface PaymentAttempt {
  id: string;
  orderNumber: string;
  method: string;
  amount: number;
  status: 'Success' | 'Failed' | 'Pending';
  failureReason?: string;
  date: string;
}

const INITIAL_GATEWAYS: Record<GatewayId, GatewayConfig> = {
  mpesa: {
    id: 'mpesa',
    name: 'Safaricom M-Pesa STK Push',
    description: 'Instant mobile money checkout for Kenyan customers.',
    logoBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
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
  },
  airtel: {
    id: 'airtel',
    name: 'Airtel Money Kenya',
    description: 'Direct mobile wallet payment gateway.',
    logoBg: 'bg-red-50 text-red-600 border-red-100',
    status: 'Enabled',
    mode: 'Test',
    todayVolume: 38400,
    successRate: 94.2,
    credentials: {
      clientId: 'airtel_test_client_88291',
      clientSecret: 'sec_airtel_test_77619203',
      pin: '4321',
      callbackUrl: 'https://api.sokoflow.co.ke/v1/payments/airtel/callback/',
    },
  },
  stripe: {
    id: 'stripe',
    name: 'Stripe International Card',
    description: 'Global Visa, Mastercard, and digital wallets.',
    logoBg: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    status: 'Enabled',
    mode: 'Test',
    todayVolume: 95000,
    successRate: 99.1,
    credentials: {
      publishableKey: 'pk_test_51Oxyz99827364501928374',
      secretKey: 'sk_test_51Oxyz99827364501928374secret',
      webhookSecret: 'whsec_test_abc123xyz789',
    },
  },
  cod: {
    id: 'cod',
    name: 'Cash on Delivery (COD)',
    description: 'Pay cash upon physical delivery or doorstep pickup.',
    logoBg: 'bg-amber-50 text-amber-700 border-amber-100',
    status: 'Enabled',
    mode: 'Live',
    todayVolume: 24500,
    successRate: 91.0,
    credentials: {
      enabled: 'true',
      instructions:
        'Please inspect goods before handing cash to the delivery rider. Exact change is appreciated.',
    },
  },
};

const INITIAL_ATTEMPTS: PaymentAttempt[] = [
  { id: 'att-1', orderNumber: '#SKO-9842', method: 'M-Pesa', amount: 157500, status: 'Success', date: '2026-09-23 21:14' },
  { id: 'att-2', orderNumber: '#SKO-9843', method: 'Stripe', amount: 68000, status: 'Success', date: '2026-09-23 20:42' },
  { id: 'att-3', orderNumber: '#SKO-9840', method: 'Airtel Money', amount: 14500, status: 'Failed', failureReason: 'Request cancelled by user (1032)', date: '2026-09-23 19:10' },
  { id: 'att-4', orderNumber: '#SKO-9839', method: 'M-Pesa', amount: 32000, status: 'Success', date: '2026-09-23 18:05' },
  { id: 'att-5', orderNumber: '#SKO-9835', method: 'Cash on Delivery', amount: 8900, status: 'Success', date: '2026-09-23 16:30' },
  { id: 'att-6', orderNumber: '#SKO-9831', method: 'M-Pesa', amount: 45000, status: 'Failed', failureReason: 'Insufficient funds (1001)', date: '2026-09-23 14:22' },
  { id: 'att-7', orderNumber: '#SKO-9828', method: 'Stripe', amount: 24000, status: 'Success', date: '2026-09-23 13:12' },
  { id: 'att-8', orderNumber: '#SKO-9824', method: 'Airtel Money', amount: 12000, status: 'Success', date: '2026-09-23 11:45' },
];

const SPARKLINE_DATA = {
  mpesa: [{ v: 40 }, { v: 65 }, { v: 45 }, { v: 80 }, { v: 70 }, { v: 95 }, { v: 100 }],
  airtel: [{ v: 30 }, { v: 45 }, { v: 50 }, { v: 40 }, { v: 60 }, { v: 55 }, { v: 70 }],
  stripe: [{ v: 50 }, { v: 60 }, { v: 75 }, { v: 85 }, { v: 90 }, { v: 85 }, { v: 95 }],
  cod: [{ v: 60 }, { v: 50 }, { v: 45 }, { v: 55 }, { v: 40 }, { v: 45 }, { v: 42 }],
};

export default function PaymentsOverviewPage() {
  const [gateways, setGateways] = useState<Record<GatewayId, GatewayConfig>>(INITIAL_GATEWAYS);
  const [attempts, setAttempts] = useState<PaymentAttempt[]>(INITIAL_ATTEMPTS);

  const [activeConfigGateway, setActiveConfigGateway] = useState<GatewayId | null>(null);
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
    if (!activeConfigGateway) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveConfigGateway(null);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [activeConfigGateway]);

  const totalVolume = Object.values(gateways).reduce((a, g) => a + g.todayVolume, 0);
  const getPercentage = (vol: number) => (totalVolume === 0 ? 0 : Math.round((vol / totalVolume) * 100));

  const openConfigure = (id: GatewayId) => {
    setActiveConfigGateway(id);
    setTempCredentials({ ...gateways[id].credentials });
    setShowPasswordFields({});
  };

  const saveCredentials = () => {
    if (!activeConfigGateway) return;
    setGateways((prev) => ({
      ...prev,
      [activeConfigGateway]: { ...prev[activeConfigGateway], credentials: { ...tempCredentials } },
    }));
    setActiveConfigGateway(null);
    setToastMessage('Gateway configuration saved');
  };

  const toggleStatus = (id: GatewayId) => {
    setGateways((prev) => ({
      ...prev,
      [id]: { ...prev[id], status: prev[id].status === 'Enabled' ? 'Disabled' : 'Enabled' },
    }));
    setToastMessage('Gateway status updated');
  };

  const testConnection = () => {
    setIsTesting(true);
    setTimeout(() => {
      setIsTesting(false);
      setToastMessage('Connection test passed');
    }, 1100);
  };

  const retryAttempt = (id: string, orderNum: string) => {
    setAttempts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Success', failureReason: undefined } : a))
    );
    setToastMessage(`Retry successful for ${orderNum}`);
  };

  const methodBadge = (m: string) =>
    m === 'M-Pesa'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : m === 'Airtel Money'
      ? 'bg-red-50 text-red-700 border-red-100'
      : m === 'Stripe'
      ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
      : 'bg-amber-50 text-amber-700 border-amber-100';

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
            <p className="text-[13px] text-slate-500 mt-0.5">Payment gateway overview and settings</p>
          </div>
          <button
            onClick={() => openConfigure('mpesa')}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configure gateways</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* TOP KPI CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {(['mpesa', 'airtel', 'stripe', 'cod'] as const).map((id) => {
            const gw = gateways[id];
            const pct = getPercentage(gw.todayVolume);
            const tint =
              id === 'mpesa'
                ? { bg: 'bg-emerald-50 text-emerald-700', stroke: '#059669', fill: '#10b981' }
                : id === 'airtel'
                ? { bg: 'bg-red-50 text-red-600', stroke: '#dc2626', fill: '#ef4444' }
                : id === 'stripe'
                ? { bg: 'bg-indigo-50 text-indigo-700', stroke: '#4f46e5', fill: '#6366f1' }
                : { bg: 'bg-amber-50 text-amber-700', stroke: '#d97706', fill: '#f59e0b' };

            return (
              <div key={id} className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-slate-500 truncate">
                    {gw.name.split(' ')[0]} volume
                  </span>
                  <span
                    className={`text-[13px] font-medium px-1.5 py-0.5 rounded-sm shrink-0 ${tint.bg}`}
                  >
                    {pct}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-bold text-slate-900 truncate">
                    KES {gw.todayVolume.toLocaleString()}
                  </span>
                  <span className="text-[13px] font-medium text-emerald-600 inline-flex items-center gap-0.5 shrink-0">
                    <ArrowUpRight className="w-3 h-3" />
                    +14%
                  </span>
                </div>
                <div className="h-8 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={SPARKLINE_DATA[id]}>
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke={tint.stroke}
                        fill={tint.fill}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>

        {/* GATEWAYS */}
        <div className="bg-white border border-slate-200 rounded-sm">
          <div className="px-3 py-2 border-b border-slate-200">
            <p className="text-[13px] font-semibold text-slate-900">Active payment gateways</p>
          </div>

          <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
            {(Object.keys(gateways) as GatewayId[]).map((key) => {
              const gw = gateways[key];
              return (
                <div
                  key={gw.id}
                  className="border border-slate-200 rounded-sm p-2 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-9 h-9 rounded-sm flex items-center justify-center border shrink-0 ${gw.logoBg}`}
                      >
                        {gw.id === 'stripe' ? (
                          <CreditCard className="w-4 h-4" />
                        ) : gw.id === 'cod' ? (
                          <DollarSign className="w-4 h-4" />
                        ) : (
                          <Smartphone className="w-4 h-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-900 truncate">{gw.name}</p>
                        <p className="text-[13px] text-slate-500 truncate">{gw.description}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleStatus(gw.id)}
                      className={`text-[13px] font-medium px-2 py-0.5 rounded-sm border transition shrink-0 ${
                        gw.status === 'Enabled'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {gw.status}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 text-[13px]">
                    <div>
                      <p className="text-slate-500">Mode</p>
                      <span
                        className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-sm font-medium ${
                          gw.mode === 'Production'
                            ? 'bg-purple-50 text-purple-700 border border-purple-100'
                            : gw.mode === 'Live'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}
                      >
                        {gw.mode}
                      </span>
                    </div>
                    <div>
                      <p className="text-slate-500">Volume</p>
                      <p className="font-medium text-slate-900 mt-0.5 truncate">
                        KES {gw.todayVolume.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Success</p>
                      <p className="font-medium text-emerald-600 mt-0.5">{gw.successRate}%</p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => openConfigure(gw.id)}
                      className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-blue-950 hover:border-blue-950 hover:text-white text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] transition"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Configure
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RECENT ATTEMPTS */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-slate-900">Recent payment attempts</p>
              <p className="text-[13px] text-slate-500">Live transaction logs across all providers</p>
            </div>
            <span className="text-[13px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-sm">
              {attempts.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2 px-3 font-medium">Order</th>
                  <th className="py-2 px-3 font-medium">Method</th>
                  <th className="py-2 px-3 font-medium text-right">Amount</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium">Failure reason</th>
                  <th className="py-2 px-3 font-medium">Date</th>
                  <th className="py-2 px-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attempts.map((att) => (
                  <tr key={att.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-mono font-medium text-blue-950">{att.orderNumber}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${methodBadge(
                          att.method
                        )}`}
                      >
                        {att.method}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-slate-900">
                      {att.amount.toLocaleString()}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border ${
                          att.status === 'Success'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : att.status === 'Failed'
                            ? 'bg-red-50 text-red-600 border-red-100'
                            : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}
                      >
                        {att.status === 'Success' && <Check className="w-3 h-3" />}
                        {att.status === 'Failed' && <X className="w-3 h-3" />}
                        {att.status}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {att.failureReason ? (
                        <span className="text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-sm font-mono inline-block">
                          {att.failureReason}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-400">{att.date}</td>
                    <td className="py-2 px-3">
                      {att.status === 'Failed' ? (
                        <button
                          onClick={() => retryAttempt(att.id, att.orderNumber)}
                          className="inline-flex items-center gap-1 bg-blue-950 hover:bg-blue-900 text-white px-2.5 py-2 rounded-sm font-medium text-[13px] transition"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Retry
                        </button>
                      ) : (
                        <span className="text-slate-400">Done</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* CONFIGURE MODAL */}
      {activeConfigGateway && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setActiveConfigGateway(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                  <Settings className="w-4 h-4" />
                </span>
                <p className="text-[15px] font-semibold text-slate-900 truncate">
                  Configure {gateways[activeConfigGateway].name}
                </p>
              </div>
              <button
                onClick={() => setActiveConfigGateway(null)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
              {activeConfigGateway === 'mpesa' && (
                <>
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
                </>
              )}

              {activeConfigGateway === 'airtel' && (
                <>
                  <Field
                    label="Client ID"
                    value={tempCredentials.clientId || ''}
                    onChange={(v) => setTempCredentials({ ...tempCredentials, clientId: v })}
                    mono
                  />
                  <SecretField
                    label="Client secret"
                    value={tempCredentials.clientSecret || ''}
                    onChange={(v) => setTempCredentials({ ...tempCredentials, clientSecret: v })}
                    show={!!showPasswordFields.clientSecret}
                    onToggle={() =>
                      setShowPasswordFields((p) => ({ ...p, clientSecret: !p.clientSecret }))
                    }
                  />
                  <SecretField
                    label="API PIN"
                    value={tempCredentials.pin || ''}
                    onChange={(v) => setTempCredentials({ ...tempCredentials, pin: v })}
                    show={!!showPasswordFields.pin}
                    onToggle={() => setShowPasswordFields((p) => ({ ...p, pin: !p.pin }))}
                  />
                  <Field
                    label="Callback URL"
                    value={tempCredentials.callbackUrl || ''}
                    onChange={(v) => setTempCredentials({ ...tempCredentials, callbackUrl: v })}
                    mono
                  />
                </>
              )}

              {activeConfigGateway === 'stripe' && (
                <>
                  <Field
                    label="Publishable key"
                    value={tempCredentials.publishableKey || ''}
                    onChange={(v) => setTempCredentials({ ...tempCredentials, publishableKey: v })}
                    mono
                  />
                  <SecretField
                    label="Secret key"
                    value={tempCredentials.secretKey || ''}
                    onChange={(v) => setTempCredentials({ ...tempCredentials, secretKey: v })}
                    show={!!showPasswordFields.secretKey}
                    onToggle={() =>
                      setShowPasswordFields((p) => ({ ...p, secretKey: !p.secretKey }))
                    }
                  />
                  <SecretField
                    label="Webhook secret"
                    value={tempCredentials.webhookSecret || ''}
                    onChange={(v) => setTempCredentials({ ...tempCredentials, webhookSecret: v })}
                    show={!!showPasswordFields.webhookSecret}
                    onToggle={() =>
                      setShowPasswordFields((p) => ({ ...p, webhookSecret: !p.webhookSecret }))
                    }
                  />
                </>
              )}

              {activeConfigGateway === 'cod' && (
                <>
                  <label className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2 rounded-sm cursor-pointer">
                    <div>
                      <p className="font-medium text-slate-800">Enable Cash on Delivery</p>
                      <p className="text-[13px] text-slate-500">
                        Allow buyers to pay cash on doorstep delivery
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={tempCredentials.enabled === 'true'}
                      onChange={(e) =>
                        setTempCredentials({
                          ...tempCredentials,
                          enabled: e.target.checked ? 'true' : 'false',
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950"
                    />
                  </label>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Customer instructions
                    </label>
                    <textarea
                      rows={4}
                      value={tempCredentials.instructions || ''}
                      onChange={(e) =>
                        setTempCredentials({ ...tempCredentials, instructions: e.target.value })
                      }
                      className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                    />
                  </div>
                </>
              )}
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
                  onClick={() => setActiveConfigGateway(null)}
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
        className={`w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 ${
          mono ? 'font-mono' : ''
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
