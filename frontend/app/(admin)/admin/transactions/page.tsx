'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Smartphone,
  DollarSign,
  Copy,
  CheckSquare,
  Square,
  Link2,
  FileText,
  Hash,
  Phone,
  User,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

// --- TYPES ---
// Transactions are SEPARATE from orders.
// An Order = commercial purchase (what was bought).
// A Transaction = financial event (how it was paid).
// M-Pesa is the ONLY payment method.

type TxStatus = 'Success' | 'Pending' | 'Failed' | 'Reversed';

interface Transaction {
  id: string;
  ref: string;                    // M-Pesa receipt / transaction reference
  orderNumber: string;            // Links to the commercial order
  amount: number;
  fee: number;                    // M-Pesa transaction fee
  phoneNumber: string;            // Payer M-Pesa number
  status: TxStatus;
  responseCode: string;           // M-Pesa result code
  responseDesc: string;           // M-Pesa result description
  date: string;
  customerName: string;
  customerEmail: string;
  merchantRequestId: string;
  checkoutRequestId: string;
  payload: Record<string, any>;   // Raw M-Pesa callback payload
  timeline: { title: string; time: string; status: 'completed' | 'active' | 'failed' }[];
}

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    ref: 'MPX9842K21',
    orderNumber: '#SKO-9842',
    amount: 157500,
    fee: 3150,
    phoneNumber: '+254 712 *** 890',
    status: 'Success',
    responseCode: '0',
    responseDesc: 'The service request is processed successfully.',
    date: '2026-09-23 21:14',
    customerName: 'Brian Kiprop',
    customerEmail: 'brian.kiprop@gmail.com',
    merchantRequestId: '29115-3465611-1',
    checkoutRequestId: 'ws_CO_23092026211412345',
    payload: {
      MerchantRequestID: '29115-3465611-1',
      CheckoutRequestID: 'ws_CO_23092026211412345',
      ResultCode: 0,
      ResultDesc: 'The service request is processed successfully.',
      Amount: 157500,
      MpesaReceiptNumber: 'MPX9842K21',
      TransactionDate: '20260923211422',
      PhoneNumber: '254712345890',
    },
    timeline: [
      { title: 'STK Push Triggered', time: '21:14:02', status: 'completed' },
      { title: 'Customer PIN Entered', time: '21:14:15', status: 'completed' },
      { title: 'M-Pesa Callback Received (Code 0)', time: '21:14:22', status: 'completed' },
      { title: 'Order Marked Paid & Fulfilled', time: '21:14:23', status: 'completed' },
    ],
  },
  {
    id: 'tx-2',
    ref: 'MPX9843B77',
    orderNumber: '#SKO-9843',
    amount: 68000,
    fee: 1360,
    phoneNumber: '+254 733 *** 654',
    status: 'Success',
    responseCode: '0',
    responseDesc: 'The service request is processed successfully.',
    date: '2026-09-23 20:42',
    customerName: 'Amina Ouma',
    customerEmail: 'amina.ouma@outlook.com',
    merchantRequestId: '29115-3465612-1',
    checkoutRequestId: 'ws_CO_23092026204212345',
    payload: {
      MerchantRequestID: '29115-3465612-1',
      CheckoutRequestID: 'ws_CO_23092026204212345',
      ResultCode: 0,
      ResultDesc: 'The service request is processed successfully.',
      Amount: 68000,
      MpesaReceiptNumber: 'MPX9843B77',
      TransactionDate: '20260923204211',
      PhoneNumber: '254733987654',
    },
    timeline: [
      { title: 'STK Push Triggered', time: '20:42:01', status: 'completed' },
      { title: 'Customer PIN Entered', time: '20:42:10', status: 'completed' },
      { title: 'M-Pesa Callback Received (Code 0)', time: '20:42:11', status: 'completed' },
    ],
  },
  {
    id: 'tx-3',
    ref: 'MPX9840C12',
    orderNumber: '#SKO-9840',
    amount: 14500,
    fee: 290,
    phoneNumber: '+254 733 *** 112',
    status: 'Failed',
    responseCode: '1032',
    responseDesc: 'Request cancelled by user',
    date: '2026-09-23 19:10',
    customerName: 'Kevin Juma',
    customerEmail: 'kjuma@yahoo.com',
    merchantRequestId: '29115-3465613-1',
    checkoutRequestId: 'ws_CO_23092026191012345',
    payload: {
      MerchantRequestID: '29115-3465613-1',
      CheckoutRequestID: 'ws_CO_23092026191012345',
      ResultCode: 1032,
      ResultDesc: 'Request cancelled by user',
      Amount: 14500,
      MpesaReceiptNumber: '',
      TransactionDate: '20260923191005',
      PhoneNumber: '254733111112',
    },
    timeline: [
      { title: 'STK Push Triggered', time: '19:09:40', status: 'completed' },
      { title: 'Waiting for PIN Prompt', time: '19:09:55', status: 'active' },
      { title: 'User Cancelled Request (1032)', time: '19:10:05', status: 'failed' },
    ],
  },
  {
    id: 'tx-4',
    ref: 'MPX9839A10',
    orderNumber: '#SKO-9839',
    amount: 32000,
    fee: 640,
    phoneNumber: '+254 722 *** 445',
    status: 'Success',
    responseCode: '0',
    responseDesc: 'The service request is processed successfully.',
    date: '2026-09-23 18:05',
    customerName: 'Sarah Wanjiru',
    customerEmail: 'sarah.w@sokoflow.co.ke',
    merchantRequestId: '12844-882910-1',
    checkoutRequestId: 'ws_CO_23092026180512345',
    payload: {
      MerchantRequestID: '12844-882910-1',
      CheckoutRequestID: 'ws_CO_23092026180512345',
      ResultCode: 0,
      ResultDesc: 'Success',
      Amount: 32000,
      MpesaReceiptNumber: 'MPX9839A10',
      TransactionDate: '20260923180512',
      PhoneNumber: '254722111445',
    },
    timeline: [
      { title: 'STK Push Triggered', time: '18:04:40', status: 'completed' },
      { title: 'Callback Received (Code 0)', time: '18:05:12', status: 'completed' },
    ],
  },
  {
    id: 'tx-5',
    ref: 'MPX9835D55',
    orderNumber: '#SKO-9835',
    amount: 8900,
    fee: 178,
    phoneNumber: '+254 701 *** 223',
    status: 'Success',
    responseCode: '0',
    responseDesc: 'The service request is processed successfully.',
    date: '2026-09-23 16:30',
    customerName: 'David Mutua',
    customerEmail: 'dmutua@gmail.com',
    merchantRequestId: '12844-882911-1',
    checkoutRequestId: 'ws_CO_23092026163012345',
    payload: {
      MerchantRequestID: '12844-882911-1',
      CheckoutRequestID: 'ws_CO_23092026163012345',
      ResultCode: 0,
      ResultDesc: 'Success',
      Amount: 8900,
      MpesaReceiptNumber: 'MPX9835D55',
      TransactionDate: '20260923163022',
      PhoneNumber: '254701222223',
    },
    timeline: [
      { title: 'STK Push Triggered', time: '16:29:50', status: 'completed' },
      { title: 'Callback Received (Code 0)', time: '16:30:22', status: 'completed' },
    ],
  },
  {
    id: 'tx-6',
    ref: 'MPX9831B99',
    orderNumber: '#SKO-9831',
    amount: 45000,
    fee: 900,
    phoneNumber: '+254 700 *** 991',
    status: 'Failed',
    responseCode: '1001',
    responseDesc: 'The balance is insufficient for the transaction.',
    date: '2026-09-23 14:22',
    customerName: 'Mercy Chebet',
    customerEmail: 'mercy.chebet@gmail.com',
    merchantRequestId: '12844-882912-1',
    checkoutRequestId: 'ws_CO_23092026142212345',
    payload: {
      MerchantRequestID: '12844-882912-1',
      CheckoutRequestID: 'ws_CO_23092026142212345',
      ResultCode: 1001,
      ResultDesc: 'The balance is insufficient for the transaction.',
      Amount: 45000,
      MpesaReceiptNumber: '',
      TransactionDate: '20260923142215',
      PhoneNumber: '254700999991',
    },
    timeline: [
      { title: 'STK Push Sent', time: '14:21:50', status: 'completed' },
      { title: 'Insufficient Funds Error (1001)', time: '14:22:15', status: 'failed' },
    ],
  },
  {
    id: 'tx-7',
    ref: 'MPX9828E33',
    orderNumber: '#SKO-9828',
    amount: 24000,
    fee: 480,
    phoneNumber: '+254 711 *** 007',
    status: 'Success',
    responseCode: '0',
    responseDesc: 'The service request is processed successfully.',
    date: '2026-09-23 13:12',
    customerName: 'John Omondi',
    customerEmail: 'john.omondi@tech.co.ke',
    merchantRequestId: '12844-882913-1',
    checkoutRequestId: 'ws_CO_23092026131212345',
    payload: {
      MerchantRequestID: '12844-882913-1',
      CheckoutRequestID: 'ws_CO_23092026131212345',
      ResultCode: 0,
      ResultDesc: 'Success',
      Amount: 24000,
      MpesaReceiptNumber: 'MPX9828E33',
      TransactionDate: '20260923131205',
      PhoneNumber: '254711000007',
    },
    timeline: [
      { title: 'STK Push Triggered', time: '13:10:00', status: 'completed' },
      { title: 'Callback Received (Code 0)', time: '13:12:05', status: 'completed' },
    ],
  },
  {
    id: 'tx-8',
    ref: 'MPX9820REV',
    orderNumber: '#SKO-9815',
    amount: 120000,
    fee: 2400,
    phoneNumber: '+254 722 *** 102',
    status: 'Reversed',
    responseCode: 'REV_C2B',
    responseDesc: 'Duplicate payment reversed by merchant.',
    date: '2026-09-22 10:15',
    customerName: 'Grace Njeri',
    customerEmail: 'grace.njeri@gmail.com',
    merchantRequestId: '12844-882914-1',
    checkoutRequestId: 'ws_CO_22092026101512345',
    payload: {
      MerchantRequestID: '12844-882914-1',
      CheckoutRequestID: 'ws_CO_22092026101512345',
      ResultCode: 0,
      ResultDesc: 'Success',
      Amount: 120000,
      MpesaReceiptNumber: 'MPX9820REV',
      TransactionDate: '20260922093000',
      PhoneNumber: '254722111102',
      ReversalReason: 'Duplicate payment initiated by customer',
      OriginalReceipt: 'MPX9820OLD',
      ReversalTransactionID: 'MPX9820REV',
    },
    timeline: [
      { title: 'Payment Success', time: '09:30:00', status: 'completed' },
      { title: 'Refund/Reversal Requested', time: '10:00:00', status: 'completed' },
      { title: 'M-Pesa Reversal Executed', time: '10:15:20', status: 'completed' },
    ],
  },
];

const STATUSES: TxStatus[] = ['Success', 'Pending', 'Failed', 'Reversed'];
const DATE_RANGES = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days'];

export default function TransactionsLedgerPage() {
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<TxStatus | null>(null);
  const [dateRange, setDateRange] = useState('Today');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [activeTx, setActiveTx] = useState<Transaction | null>(null);
  const [reconcileTx, setReconcileTx] = useState<Transaction | null>(null);
  const [reconcileStatus, setReconcileStatus] = useState<'Matched' | 'Unmatched'>('Matched');
  const [reconcileOrder, setReconcileOrder] = useState('');
  const [reconcileNote, setReconcileNote] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        tx.ref.toLowerCase().includes(q) ||
        tx.orderNumber.toLowerCase().includes(q) ||
        tx.customerName.toLowerCase().includes(q) ||
        tx.customerEmail.toLowerCase().includes(q) ||
        tx.phoneNumber.toLowerCase().includes(q);
      const matchesStatus = !selectedStatus || tx.status === selectedStatus;
      const amt = tx.amount;
      const matchesMin = minAmount === '' || amt >= Number(minAmount);
      const matchesMax = maxAmount === '' || amt <= Number(maxAmount);
      return matchesSearch && matchesStatus && matchesMin && matchesMax;
    });
  }, [transactions, searchQuery, selectedStatus, minAmount, maxAmount]);

  const totalSuccessful = filtered.filter((t) => t.status === 'Success').reduce((a, t) => a + t.amount, 0);
  const totalFailed = filtered.filter((t) => t.status === 'Failed').reduce((a, t) => a + t.amount, 0);
  const totalPending = filtered.filter((t) => t.status === 'Pending').reduce((a, t) => a + t.amount, 0);
  const totalFees = filtered.reduce((a, t) => a + t.fee, 0);
  const netAmount = totalSuccessful - totalFees;

  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length;
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : filtered.map((t) => t.id));
  const toggleRow = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const handleRetry = (tx: Transaction) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === tx.id
          ? {
            ...t,
            status: 'Success',
            responseCode: '0',
            responseDesc: 'The service request is processed successfully.',
            ref: t.ref.startsWith('MPX') ? t.ref : `MPX${Date.now().toString().slice(-6)}`,
          }
          : t
      )
    );
    if (activeTx?.id === tx.id) {
      setActiveTx((prev) =>
        prev
          ? {
            ...prev,
            status: 'Success',
            responseCode: '0',
            responseDesc: 'The service request is processed successfully.',
          }
          : null
      );
    }
    setToastMessage(`M-Pesa transaction ${tx.ref} retried successfully`);
  };

  const saveReconciliation = () => {
    if (!reconcileTx) return;
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === reconcileTx.id
          ? {
            ...t,
            orderNumber: reconcileOrder || t.orderNumber,
            payload: {
              ...t.payload,
              reconciliationNote: reconcileNote,
              reconciliationStatus: reconcileStatus,
            },
          }
          : t
      )
    );
    setToastMessage(`Transaction ${reconcileTx.ref} reconciled`);
    setReconcileTx(null);
    setReconcileNote('');
    setReconcileOrder('');
  };

  const statusBadge = (s: TxStatus) =>
    s === 'Success'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'Failed'
        ? 'bg-red-50 text-red-600 border-red-100'
        : s === 'Reversed'
          ? 'bg-purple-50 text-purple-700 border-purple-100'
          : 'bg-amber-50 text-amber-700 border-amber-100';

  const activeFilterCount =
    (selectedStatus ? 1 : 0) + (minAmount || maxAmount ? 1 : 0);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedStatus(null);
    setMinAmount('');
    setMaxAmount('');
  };

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
            <h1 className="text-[15px] font-semibold text-slate-900">Transactions</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              M-Pesa financial ledger & gateway event stream
            </p>
          </div>
          <button
            onClick={() => setToastMessage(`Exporting ${filtered.length} transactions as CSV…`)}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* SEPARATION NOTE: Order vs Transaction */}
        <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 flex items-start gap-2">
          <Link2 className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
          <div className="text-[13px]">
            <p className="font-medium text-blue-950">Orders vs Transactions</p>
            <p className="text-blue-800 mt-0.5">
              An <span className="font-medium">Order</span> represents the commercial purchase (what was bought).
              A <span className="font-medium">Transaction</span> represents the financial event (how it was paid).
              Multiple M-Pesa transactions can settle a single order.
            </p>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Successful</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5 truncate">
                KES {totalSuccessful.toLocaleString()}
              </p>
              <p className="text-[13px] text-emerald-600 mt-0.5 inline-flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" /> Completed
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Pending</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5 truncate">
                KES {totalPending.toLocaleString()}
              </p>
              <p className="text-[13px] text-amber-600 mt-0.5">Awaiting callback</p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Failed</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5 truncate">
                KES {totalFailed.toLocaleString()}
              </p>
              <p className="text-[13px] text-red-600 mt-0.5 inline-flex items-center gap-0.5">
                <ArrowDownRight className="w-3 h-3" /> Declined
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <XCircle className="w-4 h-4" />
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">M-Pesa Fees</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5 truncate">
                KES {totalFees.toLocaleString()}
              </p>
              <p className="text-[13px] text-indigo-600 mt-0.5">Deductions</p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>

          <div className="bg-blue-950 text-white border border-blue-900 rounded-sm p-2 flex items-start justify-between gap-2 col-span-2 lg:col-span-1">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-blue-300">Net settled</p>
              <p className="text-[15px] font-bold text-white mt-0.5 truncate">
                KES {netAmount.toLocaleString()}
              </p>
              <p className="text-[13px] text-emerald-400 mt-0.5">Ledger balance</p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-blue-900 text-blue-100 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search M-Pesa ref, order #, phone, customer…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              label="Status"
              value={selectedStatus}
              options={STATUSES as unknown as string[]}
              onChange={(v) => setSelectedStatus(v as TxStatus | null)}
            />
            <FilterDropdown
              label={dateRange}
              value={null}
              options={DATE_RANGES}
              onChange={(v) => setDateRange(v ?? 'Today')}
            />

            <div className="flex items-center gap-1">
              <input
                type="number"
                placeholder="Min"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-20 bg-white border border-slate-200 rounded-sm px-2 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
              <span className="text-slate-400 text-[13px]">–</span>
              <input
                type="number"
                placeholder="Max"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="w-20 bg-white border border-slate-200 rounded-sm px-2 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

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

        {/* BULK */}
        {selectedIds.length > 0 && (
          <div className="bg-blue-950 text-white rounded-sm px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-medium">{selectedIds.length} selected</span>
            <button
              onClick={() => {
                setToastMessage('Selected transactions exported');
                setSelectedIds([]);
              }}
              className="bg-blue-900 hover:bg-blue-800 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
            >
              Export selected
            </button>
          </div>
        )}

        {/* TABLE */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-[13px] font-medium text-slate-700">
              M-Pesa ledger entries · {filtered.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2 px-3 w-10">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-700">
                      {allSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-950" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-2 px-3 font-medium">M-Pesa Ref</th>
                  <th className="py-2 px-3 font-medium">Order #</th>
                  <th className="py-2 px-3 font-medium text-right">Amount</th>
                  <th className="py-2 px-3 font-medium text-right">Fee</th>
                  <th className="py-2 px-3 font-medium">Phone</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium">Code</th>
                  <th className="py-2 px-3 font-medium">Date</th>
                  <th className="py-2 px-3 w-32"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 text-[13px]">
                      No M-Pesa transactions match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((tx) => {
                    const isSelected = selectedIds.includes(tx.id);
                    return (
                      <tr
                        key={tx.id}
                        onClick={() => setActiveTx(tx)}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50' : ''
                          }`}
                      >
                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleRow(tx.id)}
                            className="text-slate-400 hover:text-slate-700"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-950" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-2 px-3 font-mono font-medium text-blue-950">{tx.ref}</td>
                        <td className="py-2 px-3 font-mono text-slate-700">{tx.orderNumber}</td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900">
                          {tx.amount.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-500">
                          {tx.fee.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500">{tx.phoneNumber}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border ${statusBadge(
                              tx.status
                            )}`}
                          >
                            {tx.status === 'Success' && <Check className="w-3 h-3" />}
                            {tx.status === 'Failed' && <X className="w-3 h-3" />}
                            {tx.status === 'Pending' && <Clock className="w-3 h-3" />}
                            {tx.status === 'Reversed' && <RefreshCw className="w-3 h-3" />}
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-sm">
                            {tx.responseCode}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-400">{tx.date}</td>
                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setActiveTx(tx)}
                              title="View"
                              className="p-1.5 rounded-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {tx.status === 'Failed' && (
                              <button
                                onClick={() => handleRetry(tx)}
                                title="Retry"
                                className="p-1.5 rounded-sm bg-blue-950 hover:bg-blue-900 text-white transition"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setReconcileTx(tx);
                                setReconcileOrder(tx.orderNumber);
                              }}
                              title="Reconcile"
                              className="px-2 py-1.5 rounded-sm bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-medium transition"
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

      {/* DETAIL DRAWER */}
      {activeTx && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end"
          onClick={() => setActiveTx(null)}
        >
          <div
            className="bg-white border-l border-slate-200 w-full max-w-xl h-full flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-500">M-Pesa transaction inspector</p>
                <h2 className="text-[15px] font-semibold font-mono text-blue-950 mt-0.5 truncate">
                  {activeTx.ref}
                </h2>
              </div>
              <button
                onClick={() => setActiveTx(null)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
              {/* Quick stats */}
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Order linked" value={activeTx.orderNumber} mono icon={<Link2 className="w-3 h-3" />} />
                <Stat label="Amount" value={`KES ${activeTx.amount.toLocaleString()}`} icon={<DollarSign className="w-3 h-3" />} />
                <Stat label="M-Pesa fee" value={`KES ${activeTx.fee.toLocaleString()}`} />
                <Stat label="Response code" value={activeTx.responseCode} mono />
                <Stat label="Customer" value={activeTx.customerName} icon={<User className="w-3 h-3" />} />
                <Stat label="Phone" value={activeTx.phoneNumber} mono icon={<Phone className="w-3 h-3" />} />
                <Stat label="Merchant Request ID" value={activeTx.merchantRequestId} mono />
                <Stat label="Checkout Request ID" value={activeTx.checkoutRequestId} mono />
              </div>

              {/* Response description */}
              <div
                className={`rounded-sm p-2 border ${activeTx.status === 'Success'
                    ? 'bg-emerald-50 border-emerald-200'
                    : activeTx.status === 'Failed'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}
              >
                <p className="font-medium text-slate-700 mb-0.5">Result description</p>
                <p className="text-slate-800">{activeTx.responseDesc}</p>
              </div>

              {/* Timeline */}
              <div>
                <p className="font-medium text-slate-700 mb-2">Lifecycle timeline</p>
                <ul className="space-y-2">
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
                        className="bg-slate-50 border border-slate-200 rounded-sm p-2 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                          <span className="font-medium text-slate-800 truncate">{item.title}</span>
                        </div>
                        <span className="font-mono text-slate-400 shrink-0">{item.time}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Payload */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-slate-700">Raw M-Pesa callback payload</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(activeTx.payload, null, 2));
                      setToastMessage('Copied JSON');
                    }}
                    className="text-blue-950 hover:underline font-medium inline-flex items-center gap-1 text-[13px]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy JSON
                  </button>
                </div>
                <div className="bg-slate-900 text-slate-100 p-3 rounded-sm font-mono text-[13px] overflow-x-auto">
                  <pre>{JSON.stringify(activeTx.payload, null, 2)}</pre>
                </div>
              </div>
            </div>

            <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
              <button
                onClick={() => {
                  setReconcileTx(activeTx);
                  setReconcileOrder(activeTx.orderNumber);
                  setActiveTx(null);
                }}
                className="bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Reconcile
              </button>
              {activeTx.status === 'Failed' && (
                <button
                  onClick={() => handleRetry(activeTx)}
                  className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry M-Pesa payment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RECONCILE MODAL */}
      {reconcileTx && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setReconcileTx(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl space-y-3 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-500">Manual M-Pesa reconciliation</p>
                <h3 className="text-[15px] font-semibold font-mono text-slate-900 mt-0.5 truncate">
                  {reconcileTx.ref}
                </h3>
              </div>
              <button
                onClick={() => setReconcileTx(null)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 flex items-center justify-between">
              <div>
                <p className="text-slate-500">Amount</p>
                <p className="font-medium text-slate-900">KES {reconcileTx.amount.toLocaleString()}</p>
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
              <p className="font-medium text-slate-700 mb-1">Reconciliation status</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReconcileStatus('Matched')}
                  className={`py-2 rounded-sm font-medium border transition ${reconcileStatus === 'Matched'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  Mark matched
                </button>
                <button
                  type="button"
                  onClick={() => setReconcileStatus('Unmatched')}
                  className={`py-2 rounded-sm font-medium border transition ${reconcileStatus === 'Unmatched'
                      ? 'bg-red-50 text-red-700 border-red-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  Mark unmatched
                </button>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Attach to order</label>
              <input
                type="text"
                value={reconcileOrder}
                onChange={(e) => setReconcileOrder(e.target.value)}
                placeholder="#SKO-XXXX"
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Audit note</label>
              <textarea
                rows={3}
                value={reconcileNote}
                onChange={(e) => setReconcileNote(e.target.value)}
                placeholder="Explain manual match or discrepancy…"
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setReconcileTx(null)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={saveReconciliation}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Save reconciliation
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
        className={`flex items-center gap-1.5 border rounded-sm px-3 py-2 text-[13px] font-medium transition whitespace-nowrap ${isActive
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

/* ─────────── Stat ─────────── */
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
    <div className="bg-slate-50 border border-slate-200 rounded-sm p-2">
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
