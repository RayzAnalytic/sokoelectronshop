
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import {
  Camera,
  X,
  Loader2,
  AlertCircle,
  Check,
  Package,
  Phone,
  Mail,
  DollarSign,
  Hash,
  RefreshCw,
} from 'lucide-react';
import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import type {
  AdminQRVerifyResponse,
  AdminQRVerifyItem,
} from '@/lib/admin-types';

export { QRCodeSVG } from 'qrcode.react';

type ScannerState =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'verifying'; token: string }
  | { kind: 'result'; order: AdminQRVerifyResponse }
  | { kind: 'error'; message: string };

const formatKES = (amount: string | number): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(num)) return 'KES 0';
  return `KES ${num.toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const paymentStatusColor = (
  s: AdminQRVerifyResponse['payment_status'],
): string => {
  switch (s) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'refunded':
      return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    case 'failed':
      return 'bg-red-50 text-red-600 border-red-100';
    case 'unpaid':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const extractToken = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      return (
        obj.token ||
        obj.verification_token ||
        obj.id ||
        obj.order_reference ||
        null
      );
    } catch { 
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const t =
        url.searchParams.get('token') ||
        url.searchParams.get('id') ||
        url.searchParams.get('ref') ||
        url.searchParams.get('reference');
      if (t) return t;

      const parts = url.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) return last;
    } catch {
      return null;
    }
  }

  return trimmed;
};

export function QRScannerModal() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ScannerState>({ kind: 'idle' });
  const [fulfilling, setFulfilling] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = 'qr-scanner-region';
  const hasHandledRef = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      const st = scanner.getState();
      if (
        st === Html5QrcodeScannerState.SCANNING ||
        st === Html5QrcodeScannerState.PAUSED
      ) {
        await scanner.stop();
      }
      scanner.clear();
    } catch { 
    } finally {
      scannerRef.current = null;
    }
  }, []);

  const verifyToken = useCallback(async (token: string) => {
    setState({ kind: 'verifying', token });
    try {
      const order: AdminQRVerifyResponse =
        await adminApi.orders.verifyQr(token);
      hasHandledRef.current = true;
      setState({ kind: 'result', order });
    } catch (err) {
      setState({
        kind: 'error',
        message:
          err instanceof ApiError
            ? err.message || 'Could not verify this QR code.'
            : 'Could not verify this QR code.',
      });
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    hasHandledRef.current = false;
    setState({ kind: 'scanning' });

    const start = async () => {
      await new Promise((r) => setTimeout(r, 50));
      if (cancelled) return;

      const el = document.getElementById(regionId);
      if (!el) {
        setState({ kind: 'error', message: 'Scanner region missing.' });
        return;
      }

      try {
        const scanner = new Html5Qrcode(regionId, {
          verbose: false,
          formatsToSupport: undefined,
        });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (vw, vh) => {
              const min = Math.min(vw, vh);
              const size = Math.floor(min * 0.7);
              return { width: size, height: size };
            },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (hasHandledRef.current) return;
            hasHandledRef.current = true;

            const token = extractToken(decodedText);
            if (!token) {
              setState({
                kind: 'error',
                message: 'QR code did not contain a valid order token.',
              });
              void stopScanner();
              return;
            }

            void stopScanner().then(() => verifyToken(token));
          },
          () => {
            /* ignore frame misses */
          },
        );
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Camera permission denied or unavailable.';
        setState({ kind: 'error', message: msg });
      }
    };

    void start();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [open, stopScanner, verifyToken]);

  const handleClose = useCallback(async () => {
    await stopScanner();
    setOpen(false);
    setState({ kind: 'idle' });
    setFulfilling(false);
  }, [stopScanner]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !fulfilling) void handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, fulfilling, handleClose]);

  const handleRescan = useCallback(() => {
    hasHandledRef.current = false;
    setState({ kind: 'scanning' });
  }, []);

  const handleFulfill = useCallback(async () => {
    if (state.kind !== 'result') return;
    setFulfilling(true);
    try { 
      const updated: AdminQRVerifyResponse =
        await adminApi.orders.fulfillQr(state.order.reference);
      setToast(`Order #${state.order.reference} marked as fulfilled`);
      setState({ kind: 'result', order: updated });
    } catch (err) {
      setToast(
        err instanceof ApiError
          ? err.message || 'Could not update order.'
          : 'Could not update order.',
      );
    } finally {
      setFulfilling(false);
    }
  }, [state]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-18 right-6 z-50 inline-flex items-center gap-2 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-3 rounded text-[13px] transition no-print"
        aria-label="Scan QR receipt"
      >
        <Camera className="w-4 h-4" />
        <span className="hidden sm:inline">Scan QR Receipt</span>
        <span className="sm:hidden">Scan</span>
      </button>

      {toast && (
        <div className="fixed bottom-3 right-3 z-[120] bg-slate-900 text-white px-3 py-2 rounded flex items-center gap-2 text-[13px] no-print">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toast}</span>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 no-print"
          onClick={() => !fulfilling && handleClose()}
        >
          <div
            className="bg-white border border-slate-200 rounded w-full max-w-lg  overflow-hidden text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                  <Camera className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-slate-900">
                    Scan QR Receipt
                  </h3>
                  <p className="text-[12px] text-slate-500">
                    Point the camera at the customer&apos;s order QR
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={fulfilling}
                className="h-8 w-8 rounded hover:bg-slate-100 flex items-center justify-center text-slate-500 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2 space-y-2 max-h-[85vh] overflow-y-auto">
              {state.kind === 'scanning' && (
                <>
                  <div className="relative bg-black rounded overflow-hidden border border-slate-200">
                    <div
                      id={regionId}
                      className="w-full aspect-square [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="w-4/5 aspect-square border-2 border-white/80 rounded relative">
                        <span className="absolute -top-px -left-px w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded " />
                        <span className="absolute -top-px -right-px w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded " />
                        <span className="absolute -bottom-px -left-px w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded " />
                        <span className="absolute -bottom-px -right-px w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded " />
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-slate-500 text-[13px] flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Aligning camera… hold steady
                  </p>
                </>
              )}

              {state.kind === 'verifying' && (
                <div className="py-10 text-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-950 mx-auto" />
                  <p className="font-medium text-slate-900">Verifying receipt…</p>
                  <p className="text-[13px] text-slate-500 font-mono truncate px-6">
                    {state.token}
                  </p>
                </div>
              )}

              {state.kind === 'error' && (
                <div className="space-y-2">
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-medium">Scan failed</p>
                      <p className="text-[12px] mt-0.5">{state.message}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleRescan}
                    className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded "
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Try again
                  </button>
                </div>
              )}

              {state.kind === 'result' && (
                <VerifiedOrderView
                  order={state.order}
                  fulfilling={fulfilling}
                  onFulfill={handleFulfill}
                  onRescan={handleRescan}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default QRScannerModal;

function VerifiedOrderView({
  order,
  fulfilling,
  onFulfill,
  onRescan,
}: {
  order: AdminQRVerifyResponse;
  fulfilling: boolean;
  onFulfill: () => void;
  onRescan: () => void;
}) {
  const alreadyFulfilled =
    order.fulfilled || order.status === 'delivered';

  return (
    <div className="space-y-2">
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-2 rounded flex items-center gap-2">
        <Check className="w-4 h-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium">Receipt verified</p>
          <p className="text-[12px] text-emerald-700">
            Order #{order.reference} · {formatDate(order.created_at)}
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded p-2 space-y-2">
        <h4 className="text-[13px] font-semibold text-slate-900">Customer</h4>
        <div className="pt-2 border-t border-slate-100 space-y-1">
          <p className="font-medium text-slate-900">
            {order.customer_name || '—'}
          </p>
          {order.customer_phone && (
            <p className="text-slate-600 font-mono flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-slate-400" />
              {order.customer_phone}
            </p>
          )}
          {order.customer_email && (
            <p className="text-slate-600 truncate flex items-center gap-1.5">
              <Mail className="w-3 h-3 text-slate-400" />
              {order.customer_email}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded p-2 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[13px] font-semibold text-slate-900">Payment</h4>
          <span
            className={`inline-block px-2 py-0.5 rounded font-medium text-[13px] border ${paymentStatusColor(
              order.payment_status,
            )}`}
          >
            {order.payment_status_label}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-200 rounded p-2">
          <div>
            <p className="text-slate-500 text-[12px]">Method</p>
            <p className="font-medium text-slate-900 mt-0.5">
              {order.payment_method}
            </p>
          </div>
          <div>
            <p className="text-slate-500 text-[12px]">M-Pesa Ref</p>
            <p className="font-mono font-medium text-blue-950 mt-0.5 truncate">
              {order.mpesa_receipt_number || '—'}
            </p>
          </div>
          <div className="col-span-2 flex items-center justify-between pt-2 border-t border-slate-200">
            <span className="text-slate-500 text-[12px] flex items-center gap-1.5">
              <DollarSign className="w-3 h-3" />
              Total paid
            </span>
            <span className="font-semibold text-slate-900">
              {formatKES(order.total)}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded p-2 space-y-2">
        <h4 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" />
          Items ({order.items.length})
        </h4>
        <ul className="divide-y divide-slate-100">
          {order.items.map((item: AdminQRVerifyItem) => (
            <li key={item.id} className="py-2 flex items-start gap-2">
              {item.image ? ( 
                <img
                  src={item.image}
                  alt=""
                  className="w-9 h-9 rounded object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <span className="w-9 h-9 rounded bg-slate-100 border border-slate-200 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900 truncate">
                  {item.name}
                </p>
                {item.brand && (
                  <p className="text-[13px] text-slate-400 truncate">
                    {item.brand}
                  </p>
                )}
                {(item.serial_number || item.imei) && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {item.serial_number && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[13px] font-mono text-slate-700">
                        <Hash className="w-2.5 h-2.5" />
                        S/N {item.serial_number}
                      </span>
                    )}
                    {item.imei && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[13px] font-mono text-slate-700">
                        <Hash className="w-2.5 h-2.5" />
                        IMEI {item.imei}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] text-slate-500">×{item.quantity}</p>
                <p className="font-medium text-slate-900">
                  {formatKES(item.subtotal)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <button
          onClick={onRescan}
          disabled={fulfilling}
          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded disabled:opacity-50"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Scan another
        </button>
        <button
          onClick={onFulfill}
          disabled={fulfilling || alreadyFulfilled}
          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded disabled:opacity-60"
        >
          {fulfilling ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : alreadyFulfilled ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Package className="w-3.5 h-3.5" />
          )}
          {alreadyFulfilled ? 'Already fulfilled' : 'Mark Order as Fulfilled'}
        </button>
      </div>
    </div>
  );
}