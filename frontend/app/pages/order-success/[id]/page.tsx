// app/pages/order-success/[id]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  CheckCircle2,
  Package,
  Clock,
  Truck,
  AlertCircle,
  User,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Home,
  ChevronRight,
  Banknote,
  Smartphone,
  Lock,
  Receipt,
  UserCircle2,
  LogIn,
  UserPlus,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import {
  api,
  paymentsApi,
  type Me,
  type Payment,
  type PaymentStatus,
} from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Local storage shape
// ─────────────────────────────────────────────────────────────────────────────
interface StoredOrderItem {
  id: string;
  productId: string;
  name: string;
  brand: string;
  price: number;
  quantity: number;
  image: string;
}

interface StoredOrder {
  orderReference: string;
  date: string;
  total: number;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  paymentLabel: string;
  deliveryMethod: 'express' | 'standard' | 'pickup';
  estimatedDelivery: string;
  coupon: string | null;
  notes: string | null;
  customer: {
    email: string;
    phone: string;
    fullName: string;
    address: {
      street: string;
      town: string;
      county: string;
      postalCode: string;
    };
  };
  items: StoredOrderItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const formatKES = (n: number | string) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (!Number.isFinite(num)) return 'KES 0';
  return `KES ${num.toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

const numOr0 = (v: string | number | null | undefined): number => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n as number) ? (n as number) : 0;
};

const deliveryLabel = (method: StoredOrder['deliveryMethod']) => {
  if (method === 'express') return 'Express courier';
  if (method === 'pickup') return 'Store pickup';
  return 'Standard shipping';
};

const paymentLabelFor = (method: Payment['payment_method']): string => {
  return method === 'COD' ? 'Cash on delivery' : 'M-PESA';
};

function paymentToStoredOrder(payment: Payment): StoredOrder | null {
  const snap = payment.snapshot;
  if (!snap) return null;

  const items = snap.items ?? [];

  return {
    orderReference: payment.order_reference,
    date: payment.created_at,
    total: numOr0(snap.total),
    subtotal: numOr0(snap.subtotal),
    discount: numOr0(snap.discount),
    shipping: numOr0(snap.shipping),
    tax: numOr0(snap.tax),
    paymentLabel: paymentLabelFor(payment.payment_method),
    deliveryMethod: snap.delivery_method,
    estimatedDelivery: snap.estimated_delivery,
    coupon: snap.coupon || null,
    notes: snap.notes || null,
    customer: {
      email: snap.email,
      phone: snap.phone,
      fullName: snap.full_name,
      address: {
        street: snap.address_street,
        town: snap.address_town,
        county: snap.address_county,
        postalCode: snap.address_postal_code,
      },
    },
    items: items.map((i, idx) => ({
      id: `item-${idx}`,
      productId: i.productId ?? '',
      name: i.name,
      brand: i.brand ?? '',
      price: numOr0(i.price),
      quantity: i.quantity,
      image: i.image ?? '',
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived view state — one place to decide what kind of order this is
// ─────────────────────────────────────────────────────────────────────────────

type ViewState =
  | 'paid-success'      // M-Pesa, payment SUCCESS
  | 'cod-confirmed'     // COD — pay on delivery
  | 'payment-pending'   // M-Pesa still PENDING/PROCESSING
  | 'payment-failed'    // M-Pesa FAILED/TIMEOUT/CANCELLED
  | 'unknown';          // No payment data and no COD hint

function deriveViewState(
  order: StoredOrder,
  payment: Payment | null,
): ViewState {
  const isCod = order.paymentLabel === 'Cash on delivery';

  if (isCod) return 'cod-confirmed';

  if (!payment) return 'unknown';

  if (payment.status === 'SUCCESS') return 'paid-success';
  if (payment.status === 'PENDING' || payment.status === 'PROCESSING') {
    return 'payment-pending';
  }
  return 'payment-failed';
}

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: 'Awaiting payment',
  PROCESSING: 'Payment processing',
  SUCCESS: 'Paid',
  FAILED: 'Payment failed',
  CANCELLED: 'Payment cancelled',
  TIMEOUT: 'Payment timed out',
};

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function OrderSuccessPage() {
  const params = useParams<{ id: string }>();
  const orderReference = params?.id ?? '';

  const [order, setOrder] = useState<StoredOrder | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [user, setUser] = useState<Me | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orderReference) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      // 1. sessionStorage draft — the only source for COD orders
      //    (COD has no Payment row, so `paymentsApi.byReference` 404s).
      let storedOrder: StoredOrder | null = null;
      try {
        const raw = sessionStorage.getItem(`order:${orderReference}`);
        if (raw) storedOrder = JSON.parse(raw) as StoredOrder;
      } catch {
        /* ignore corrupt JSON */
      }

      const isCodDraft = storedOrder?.paymentLabel === 'Cash on delivery';

      // 2. Auth + payment in parallel. For a known-COD order, skip
      //    the payment fetch entirely — it would just 404.
      const [meRes, payRes] = await Promise.allSettled([
        api.me(),
        isCodDraft
          ? Promise.resolve(null)
          : paymentsApi.byReference(orderReference),
      ]);

      if (cancelled) return;

      const me = meRes.status === 'fulfilled' ? meRes.value : null;
      const pay = payRes.status === 'fulfilled' ? payRes.value : null;

      setUser(me);
      setPayment(pay);

      // 3. Prefer backend snapshot — reflects the committed order.
      const fromBackend = pay ? paymentToStoredOrder(pay) : null;
      setOrder(fromBackend ?? storedOrder);

      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [orderReference]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-[13px] text-slate-500">
        Loading order…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3">
        <div className="bg-white border border-slate-200 rounded-sm p-6 max-w-md w-full text-center space-y-3">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-sm flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-[15px] font-semibold text-slate-900">
            Order not found
          </h1>
          <p className="text-[13px] text-slate-600">
            We couldn&apos;t find details for order{' '}
            <span className="font-mono font-medium">{orderReference}</span>. If
            you just placed this order, check your email — we sent the receipt
            there.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Link
              href="/pages/account/orders"
              className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px] text-center"
            >
              My orders
            </Link>
            <Link
              href="/pages/products"
              className="flex-1 bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 rounded-sm text-[13px] text-center transition"
            >
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Derived ──
  const viewState = deriveViewState(order, payment);

  const paymentMethodLabel = order.paymentLabel;
  const customerFullName = order.customer.fullName;
  const customerEmail = order.customer.email;
  const customerPhone = order.customer.phone;
  const deliveryAddress = order.customer.address.street;
  const deliveryCity = order.customer.address.town;
  const deliveryCounty = order.customer.address.county;

  const displayName =
    (user && `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()) ||
    customerFullName ||
    'Customer';

  const accountEmail = user?.email || customerEmail;

  // VAT rate as actually charged — derived from the snapshot.
  const taxableBase = order.subtotal - order.discount;
  const vatPct =
    taxableBase > 0 && order.tax > 0
      ? Math.round((order.tax / taxableBase) * 100)
      : 16;

  // ── Three customer account states ──
  const hasSession = user !== null;
  const accountExists = hasSession || payment?.user != null;
  const newCustomer = !accountExists;

  const returnTo = `/pages/order-success/${order.orderReference}`;
  const loginHref = `/auth/login?email=${encodeURIComponent(
    accountEmail,
  )}&next=${encodeURIComponent(returnTo)}`;
  const registerHref = `/auth/register?email=${encodeURIComponent(
    accountEmail,
  )}&next=${encodeURIComponent(returnTo)}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col justify-between">
      <div>
        {/* HEADER */}
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-3 h-14 flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <span className="w-7 h-7 rounded-sm bg-blue-950 text-white font-semibold flex items-center justify-center text-[13px]">
                N
              </span>
              <span className="text-[13px] font-semibold text-slate-900 tracking-tight">
                NordicStore Kenya
              </span>
            </Link>
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2 py-1 rounded-sm text-[13px] font-medium text-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="truncate">{displayName}</span>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-3 py-3 space-y-3">
          {/* BREADCRUMB */}
          <nav className="flex items-center gap-1.5 text-[13px] text-slate-500 overflow-x-auto">
            <Link
              href="/"
              className="hover:text-slate-900 inline-flex items-center gap-1 shrink-0"
            >
              <Home className="w-3.5 h-3.5" />
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <Link
              href="/pages/account"
              className="hover:text-slate-900 shrink-0"
            >
              Account
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <Link
              href="/pages/account/orders"
              className="hover:text-slate-900 shrink-0"
            >
              Orders
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-900 font-mono font-medium shrink-0">
              #{order.orderReference}
            </span>
          </nav>

          {/* SUCCESS / STATUS BLOCK — branches on viewState */}
          {viewState === 'paid-success' && (
            <StatusHeader
              tone="success"
              icon={<CheckCircle2 className="w-7 h-7" />}
              title="Payment received — order confirmed"
              description="Thank you. Your payment was processed successfully and your order is now being prepared for delivery."
              orderReference={order.orderReference}
              footer={
                <div className="inline-flex items-center gap-1.5 text-[13px] text-emerald-700">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Paid via {paymentMethodLabel}</span>
                </div>
              }
            />
          )}

          {viewState === 'cod-confirmed' && (
            <StatusHeader
              tone="warning"
              icon={<Banknote className="w-7 h-7" />}
              title="Order confirmed — pay on delivery"
              description="Your order is confirmed. No payment has been taken yet. Please have the exact amount in cash or your M-Pesa phone ready when the rider arrives."
              orderReference={order.orderReference}
              footer={
                <div className="inline-flex items-center gap-1.5 text-[13px] text-amber-700 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-sm">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>
                    Amount due on delivery:{' '}
                    <span className="font-semibold">
                      {formatKES(order.total)}
                    </span>
                  </span>
                </div>
              }
            />
          )}

          {viewState === 'payment-pending' && (
            <StatusHeader
              tone="info"
              icon={<Clock className="w-7 h-7" />}
              title="Waiting for payment confirmation"
              description="We're still waiting for M-Pesa to confirm your payment. This usually takes a few seconds. We'll email you as soon as it lands."
              orderReference={order.orderReference}
              footer={
                <div className="inline-flex items-center gap-1.5 text-[13px] text-blue-900 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-sm">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{PAYMENT_STATUS_LABEL[payment!.status]}</span>
                </div>
              }
            />
          )}

          {viewState === 'payment-failed' && (
            <StatusHeader
              tone="error"
              icon={<XCircle className="w-7 h-7" />}
              title="Payment was not completed"
              description={
                payment?.result_description ||
                "The M-Pesa request could not be completed. If money was deducted it will be refunded automatically. You can try again from your cart."
              }
              orderReference={order.orderReference}
              footer={
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link
                    href="/pages/cart"
                    className="inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-1.5 rounded-sm text-[13px] transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Try again
                  </Link>
                  <Link
                    href="/pages/products"
                    className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-1.5 rounded-sm text-[13px] transition"
                  >
                    Continue shopping
                  </Link>
                </div>
              }
            />
          )}

          {viewState === 'unknown' && (
            <StatusHeader
              tone="info"
              icon={<Package className="w-7 h-7" />}
              title="Order placed"
              description="We've received your order. You'll get an email with the latest status shortly."
              orderReference={order.orderReference}
              footer={
                <div className="inline-flex items-center gap-1.5 text-[13px] text-slate-700">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Payment: {paymentMethodLabel}</span>
                </div>
              }
            />
          )}

          {/* ACCOUNT NOTICE */}
          {hasSession && (
            <section className="bg-blue-50 border border-blue-100 rounded-sm p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-start gap-2">
                <UserCircle2 className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
                <p className="text-[13px] text-blue-950">
                  Your account is ready with{' '}
                  <span className="font-medium">{accountEmail}</span>. You can
                  track this order and manage your details anytime.
                </p>
              </div>
              <Link
                href="/pages/account"
                className="text-[13px] font-medium text-blue-950 hover:underline shrink-0"
              >
                Go to my account
              </Link>
            </section>
          )}

          {!hasSession && accountExists && (
            <section className="bg-blue-50 border border-blue-100 rounded-sm p-3 space-y-3">
              <div className="flex items-start gap-2">
                <UserCircle2 className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
                <p className="text-[13px] text-blue-950">
                  You already have an account with{' '}
                  <span className="font-medium">{accountEmail}</span>. Sign in
                  to track this order and see all your purchases. We&apos;ll
                  take you straight back to this receipt.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Link
                  href={loginHref}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-3 rounded-sm text-[13px] transition"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign in
                </Link>
                <Link
                  href={registerHref}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 px-3 rounded-sm text-[13px] transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Create a new account
                </Link>
              </div>

              <p className="text-[12px] text-blue-900/70">
                Your order is confirmed either way — you don&apos;t need to
                sign in to receive it.
              </p>
            </section>
          )}

          {newCustomer && (
            <section className="bg-blue-50 border border-blue-100 rounded-sm p-3 space-y-3">
              <div className="flex items-start gap-2">
                <UserCircle2 className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
                <p className="text-[13px] text-blue-950">
                  You checked out as a guest. Create an account with{' '}
                  <span className="font-medium">{accountEmail}</span> to track
                  this order and check out faster next time. We&apos;ll bring
                  you right back here.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Link
                  href={registerHref}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-3 rounded-sm text-[13px] transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Create an account
                </Link>
                <Link
                  href={loginHref}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 px-3 rounded-sm text-[13px] transition"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  I already have an account
                </Link>
              </div>

              <p className="text-[12px] text-blue-900/70">
                Your order is confirmed either way — you don&apos;t need an
                account to receive it.
              </p>
            </section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* LEFT */}
            <div className="md:col-span-2 space-y-3">
              <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                <SectionHeader
                  icon={<User className="w-3.5 h-3.5" />}
                  title="Customer information"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                  <InfoRow label="Full name" value={customerFullName || '—'} />
                  <InfoRow label="Email" value={customerEmail || '—'} />
                  <div className="sm:col-span-2">
                    <InfoRow
                      label="Phone (M-Pesa)"
                      value={customerPhone || '—'}
                    />
                  </div>
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                <SectionHeader
                  icon={<MapPin className="w-3.5 h-3.5" />}
                  title="Delivery information"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                  <div className="sm:col-span-2">
                    <InfoRow
                      label="Delivery address"
                      value={deliveryAddress}
                    />
                  </div>
                  <InfoRow
                    label="City / region"
                    value={`${deliveryCity}${deliveryCounty ? `, ${deliveryCounty}` : ''
                      }, Kenya`}
                  />
                  <InfoRow
                    label="Method"
                    value={deliveryLabel(order.deliveryMethod)}
                  />
                  <InfoRow
                    label="Estimated delivery"
                    value={order.estimatedDelivery}
                    success
                  />
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                <SectionHeader
                  icon={<Package className="w-3.5 h-3.5" />}
                  title={`Purchased products · ${order.items.length}`}
                />
                <ul className="divide-y divide-slate-100">
                  {order.items.map((item) => (
                    <li
                      key={item.id}
                      className="py-2 flex items-center justify-between gap-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-12 h-12 rounded-sm object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-slate-900 truncate">
                            {item.name}
                          </p>
                          <p className="text-[13px] text-slate-500">
                            Qty {item.quantity} · {formatKES(item.price)} each
                          </p>
                        </div>
                      </div>
                      <span className="text-[13px] font-medium text-slate-900 shrink-0">
                        {formatKES(item.price * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* RIGHT */}
            <aside className="space-y-3">
              <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                <p className="text-[15px] font-semibold text-slate-900 pb-2 border-b border-slate-100">
                  Order breakdown
                </p>

                <div className="space-y-2 text-[13px]">
                  <Row label="Subtotal" value={formatKES(order.subtotal)} />

                  {order.discount > 0 && (
                    <Row
                      label={`Discount${order.coupon ? ` (${order.coupon})` : ''
                        }`}
                      value={`- ${formatKES(order.discount)}`}
                      success
                    />
                  )}

                  <Row
                    label={`VAT (${vatPct}%)`}
                    value={formatKES(order.tax)}
                  />

                  <Row
                    label="Delivery fee"
                    value={
                      order.shipping === 0
                        ? 'Free'
                        : formatKES(order.shipping)
                    }
                    success={order.shipping === 0}
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-slate-900">
                    Total
                  </span>
                  <span className="text-[15px] font-bold text-slate-900">
                    {formatKES(order.total)}
                  </span>
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                <p className="text-[15px] font-semibold text-slate-900 pb-2 border-b border-slate-100">
                  Payment
                </p>

                <div className="space-y-3 text-[13px]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-500">Method</span>
                    <span className="font-medium text-slate-900 text-right inline-flex items-center gap-1.5">
                      {viewState === 'cod-confirmed' ? (
                        <Banknote className="w-3.5 h-3.5 text-amber-700" />
                      ) : (
                        <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                      )}
                      {paymentMethodLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Payment status</span>
                    <PaymentStatusBadge
                      viewState={viewState}
                      paymentStatus={payment?.status}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Order status</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium text-[13px] bg-blue-50 text-blue-950 border border-blue-100">
                      <Package className="w-3 h-3" />
                      {viewState === 'paid-success' ||
                        viewState === 'cod-confirmed'
                        ? 'Confirmed'
                        : 'Processing'}
                    </span>
                  </div>
                </div>

                {viewState === 'cod-confirmed' && (
                  <div className="bg-amber-50 border border-amber-100 rounded-sm p-2 flex items-center gap-2">
                    <Banknote className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <p className="text-[13px] text-amber-800">
                      Amount due on delivery:{' '}
                      <span className="font-semibold">
                        {formatKES(order.total)}
                      </span>
                    </p>
                  </div>
                )}

                {viewState === 'paid-success' && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-sm p-2 flex items-center gap-2">
                    <Receipt className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <p className="text-[13px] text-emerald-800">
                      Receipt issued to your email:{' '}
                      <span className="font-medium">{customerEmail}</span>
                    </p>
                  </div>
                )}

                {order.notes && (
                  <div className="bg-slate-50 border border-slate-200 rounded-sm p-2">
                    <p className="text-[13px] text-slate-500 mb-0.5">
                      Order notes
                    </p>
                    <p className="text-[13px] text-slate-800">
                      {order.notes}
                    </p>
                  </div>
                )}

                <div className="pt-2 space-y-2">
                  {hasSession ? (
                    <Link
                      href="/pages/account"
                      className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 rounded-sm text-[13px] transition"
                    >
                      Go to my account
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : accountExists ? (
                    <Link
                      href={loginHref}
                      className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 rounded-sm text-[13px] transition"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      Sign in to my account
                    </Link>
                  ) : (
                    <Link
                      href={registerHref}
                      className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 rounded-sm text-[13px] transition"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Create an account to track
                    </Link>
                  )}

                  <Link
                    href="/pages/products"
                    className="w-full inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]"
                  >
                    Continue shopping
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Secure ordering & encrypted checkout</span>
                </div>
                <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
                  <Truck className="w-3.5 h-3.5 text-blue-950" />
                  <span>Delivered by vetted courier partners</span>
                </div>
              </section>
            </aside>
          </div>
        </main>
      </div>

      <footer className="bg-white border-t border-slate-200 mt-6">
        <div className="max-w-4xl mx-auto px-3 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[13px] text-slate-500">
          <p>
            &copy; {new Date().getFullYear()} NordicStore Kenya. All rights
            reserved.
          </p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-blue-950">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-blue-950">
              Terms
            </Link>
            <Link href="/support" className="hover:text-blue-950">
              Support
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatusHeader({
  tone,
  icon,
  title,
  description,
  orderReference,
  footer,
}: {
  tone: 'success' | 'warning' | 'error' | 'info';
  icon: React.ReactNode;
  title: string;
  description: string;
  orderReference: string;
  footer?: React.ReactNode;
}) {
  const palette = {
    success: {
      wrap: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    },
    warning: {
      wrap: 'bg-amber-50 text-amber-700 border-amber-100',
    },
    error: {
      wrap: 'bg-red-50 text-red-600 border-red-100',
    },
    info: {
      wrap: 'bg-blue-50 text-blue-950 border-blue-100',
    },
  }[tone];

  return (
    <section className="bg-white border border-slate-200 rounded-sm p-6 text-center space-y-4">
      <div
        className={`w-14 h-14 rounded-sm flex items-center justify-center mx-auto border ${palette.wrap}`}
      >
        {icon}
      </div>
      <div className="space-y-1">
        <h1 className="text-[15px] font-semibold text-slate-900">{title}</h1>
        <p className="text-[13px] text-slate-600 max-w-md mx-auto">
          {description}
        </p>
      </div>
      <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-sm">
        <span className="text-[13px] text-slate-500 font-medium">
          Order ID:
        </span>
        <span className="font-mono font-semibold text-blue-950 text-[13px]">
          #{orderReference}
        </span>
      </div>
      {footer && <div className="flex justify-center">{footer}</div>}
    </section>
  );
}

function PaymentStatusBadge({
  viewState,
  paymentStatus,
}: {
  viewState: ViewState;
  paymentStatus?: PaymentStatus;
}) {
  if (viewState === 'cod-confirmed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium text-[13px] bg-amber-50 text-amber-700 border border-amber-100">
        <Clock className="w-3 h-3" />
        Pay on Delivery
      </span>
    );
  }

  if (viewState === 'paid-success') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium text-[13px] bg-emerald-50 text-emerald-700 border border-emerald-100">
        <CheckCircle2 className="w-3 h-3" />
        Paid
      </span>
    );
  }

  if (viewState === 'payment-failed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium text-[13px] bg-red-50 text-red-700 border border-red-100">
        <XCircle className="w-3 h-3" />
        {paymentStatus ? PAYMENT_STATUS_LABEL[paymentStatus] : 'Failed'}
      </span>
    );
  }

  if (viewState === 'payment-pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium text-[13px] bg-blue-50 text-blue-900 border border-blue-100">
        <Clock className="w-3 h-3" />
        {paymentStatus ? PAYMENT_STATUS_LABEL[paymentStatus] : 'Pending'}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium text-[13px] bg-slate-50 text-slate-700 border border-slate-200">
      Unknown
    </span>
  );
}

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <header className="flex items-center gap-2 pb-2 border-b border-slate-100">
      <span className="w-7 h-7 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
        {icon}
      </span>
      <p className="text-[15px] font-semibold text-slate-900 truncate">
        {title}
      </p>
    </header>
  );
}

function InfoRow({
  label,
  value,
  success,
}: {
  label: string;
  value: string;
  success?: boolean;
}) {
  return (
    <div>
      <p className="text-[13px] text-slate-500">{label}</p>
      <p
        className={`text-[13px] font-medium mt-0.5 ${success ? 'text-emerald-700' : 'text-slate-900'
          }`}
      >
        {value}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  success,
}: {
  label: string;
  value: string;
  success?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span
        className={`font-medium ${success ? 'text-emerald-700' : 'text-slate-900'
          }`}
      >
        {value}
      </span>
    </div>
  );
}