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
} from 'lucide-react';
import { api, paymentsApi, type Me, type Payment } from '@/lib/api';

// ---------- Types (matches what checkout saves to sessionStorage) ----------
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
  orderId: string;
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

/**
 * Shape of a single item as serialized in the backend's PaymentSnapshot.
 * Note `price` is a string here — DRF serializes Decimal as string.
 */
interface SnapshotItem {
  productId?: string;
  name: string;
  brand?: string;
  price: string;
  quantity: number;
  image?: string;
}

// ---------- Helpers ----------
const formatKES = (n: number | string) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (!Number.isFinite(num)) return 'KES 0';
  return `KES ${num.toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

const deliveryLabel = (method: StoredOrder['deliveryMethod']) => {
  if (method === 'express') return 'Express courier';
  if (method === 'pickup') return 'Store pickup';
  return 'Standard shipping';
};

/** Map a Payment + snapshot from the backend into the local StoredOrder shape. */
function paymentToStoredOrder(payment: Payment): StoredOrder | null {
  const snap = payment.snapshot;
  if (!snap) return null;

  const items = (snap.items as SnapshotItem[] | undefined) ?? [];

  return {
    orderId: payment.order_reference,
    date: payment.created_at,
    total: parseFloat(snap.total),
    subtotal: parseFloat(snap.subtotal),
    discount: parseFloat(snap.discount),
    shipping: parseFloat(snap.shipping),
    tax: parseFloat(snap.tax),
    paymentLabel: 'M-PESA',
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
      price: parseFloat(i.price),
      quantity: i.quantity,
      image: i.image ?? '',
    })),
  };
}

export default function OrderSuccessPage() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id ?? '';

  const [order, setOrder] = useState<StoredOrder | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [user, setUser] = useState<Me | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ─────────────────────────────────────────────────────────────────────
  // Load: auth + payment (backend) + sessionStorage fallback
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orderId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      // 1. Read from sessionStorage as an immediate fallback so the page
      //    renders without waiting on the network.
      let storedOrder: StoredOrder | null = null;
      try {
        const raw = sessionStorage.getItem(`order:${orderId}`);
        if (raw) storedOrder = JSON.parse(raw);
      } catch {
        /* ignore */
      }

      // 2. Fetch auth + payment in parallel.
      const [meRes, payRes] = await Promise.allSettled([
        api.me(),
        paymentsApi.byReference(orderId),
      ]);

      if (cancelled) return;

      const me = meRes.status === 'fulfilled' ? meRes.value : null;
      const pay = payRes.status === 'fulfilled' ? payRes.value : null;

      setUser(me);
      setPayment(pay);

      // 3. Prefer backend order data when available; fall back to storage.
      const fromBackend = pay ? paymentToStoredOrder(pay) : null;
      setOrder(fromBackend ?? storedOrder);

      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // ---------- LOADING ----------
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-[13px] text-slate-500">
        Loading order…
      </div>
    );
  }

  // ---------- NOT FOUND ----------
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
            <span className="font-mono font-medium">{orderId}</span>. If you
            just placed this order, check your email or sign in to view it in
            your account.
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

  // ---------- DERIVED ----------
  // COD was removed from checkout, so isPaidOnline is always true. Branching
  // is kept for when COD returns.
  const isPaidOnline = order.paymentLabel !== 'Cash on delivery';
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

  /**
   * An account exists if either the session already knows who we are, or the
   * backend attached a user to this payment. The second signal is the reliable
   * one right after checkout, before `api.me()` has had a chance to catch up.
   */
  const accountExists = user !== null || payment?.user != null;

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
            <Link href="/" className="hover:text-slate-900 inline-flex items-center gap-1 shrink-0">
              <Home className="w-3.5 h-3.5" />
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <Link href="/pages/account" className="hover:text-slate-900 shrink-0">
              Account
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <Link href="/pages/account/orders" className="hover:text-slate-900 shrink-0">
              Orders
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-900 font-mono font-medium shrink-0">
              #{order.orderId}
            </span>
          </nav>

          {/* SUCCESS BLOCK */}
          {isPaidOnline ? (
            <section className="bg-white border border-slate-200 rounded-sm p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-700 rounded-sm flex items-center justify-center mx-auto border border-emerald-100">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h1 className="text-[15px] font-semibold text-slate-900">
                  Payment received — order confirmed
                </h1>
                <p className="text-[13px] text-slate-600 max-w-md mx-auto">
                  Thank you. Your payment was processed successfully and your
                  order is now being prepared for delivery.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-sm">
                <span className="text-[13px] text-slate-500 font-medium">
                  Order ID:
                </span>
                <span className="font-mono font-semibold text-blue-950 text-[13px]">
                  #{order.orderId}
                </span>
              </div>

              <div className="inline-flex items-center gap-1.5 text-[13px] text-emerald-700">
                <Lock className="w-3.5 h-3.5" />
                <span>Paid via {paymentMethodLabel}</span>
              </div>
            </section>
          ) : (
            <section className="bg-white border border-slate-200 rounded-sm p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-amber-50 text-amber-700 rounded-sm flex items-center justify-center mx-auto border border-amber-100">
                <Banknote className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h1 className="text-[15px] font-semibold text-slate-900">
                  Order confirmed — pay on delivery
                </h1>
                <p className="text-[13px] text-slate-600 max-w-md mx-auto">
                  Your order is confirmed. No payment has been taken yet.
                  Please have the exact amount in cash or your M-Pesa phone
                  ready when the rider arrives.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-sm">
                <span className="text-[13px] text-slate-500 font-medium">
                  Order ID:
                </span>
                <span className="font-mono font-semibold text-blue-950 text-[13px]">
                  #{order.orderId}
                </span>
              </div>

              <div className="inline-flex items-center gap-1.5 text-[13px] text-amber-700 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-sm">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>
                  Amount due on delivery:{' '}
                  <span className="font-semibold">{formatKES(order.total)}</span>
                </span>
              </div>
            </section>
          )}

          {/* ACCOUNT CREATED NOTICE */}
          {accountExists && (
            <section className="bg-blue-50 border border-blue-100 rounded-sm p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-start gap-2">
                <UserCircle2 className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
                <p className="text-[13px] text-blue-950">
                  Your account was created with{' '}
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

            {/* LEFT — customer, delivery, products */}
            <div className="md:col-span-2 space-y-3">

              {/* CUSTOMER */}
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

              {/* DELIVERY */}
              <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                <SectionHeader
                  icon={<MapPin className="w-3.5 h-3.5" />}
                  title="Delivery information"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                  <div className="sm:col-span-2">
                    <InfoRow label="Delivery address" value={deliveryAddress} />
                  </div>
                  <InfoRow
                    label="City / region"
                    value={`${deliveryCity}${deliveryCounty ? `, ${deliveryCounty}` : ''}, Kenya`}
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

              {/* PRODUCTS */}
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
                            Qty {item.quantity} ·{' '}
                            {formatKES(item.price)} each
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

            {/* RIGHT — summary + status + actions */}
            <aside className="space-y-3">

              <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                <p className="text-[15px] font-semibold text-slate-900 pb-2 border-b border-slate-100">
                  Order breakdown
                </p>

                <div className="space-y-2 text-[13px]">
                  <Row label="Subtotal" value={formatKES(order.subtotal)} />

                  {order.discount > 0 && (
                    <Row
                      label={`Discount${order.coupon ? ` (${order.coupon})` : ''}`}
                      value={`- ${formatKES(order.discount)}`}
                      success
                    />
                  )}

                  <Row label="VAT (16%)" value={formatKES(order.tax)} />

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

              {/* PAYMENT CARD */}
              <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                <p className="text-[15px] font-semibold text-slate-900 pb-2 border-b border-slate-100">
                  Payment
                </p>

                <div className="space-y-3 text-[13px]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-500">Method</span>
                    <span className="font-medium text-slate-900 text-right inline-flex items-center gap-1.5">
                      {isPaidOnline ? (
                        <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                      ) : (
                        <Banknote className="w-3.5 h-3.5 text-amber-700" />
                      )}
                      {paymentMethodLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Status</span>
                    {isPaidOnline ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium text-[13px] bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <CheckCircle2 className="w-3 h-3" />
                        Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium text-[13px] bg-amber-50 text-amber-700 border border-amber-100">
                        <Clock className="w-3 h-3" />
                        Pay on Delivery
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Order status</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium text-[13px] bg-blue-50 text-blue-950 border border-blue-100">
                      <Package className="w-3 h-3" />
                      Processing
                    </span>
                  </div>
                </div>

                {!isPaidOnline && (
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

                {isPaidOnline && (
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
                    <p className="text-[13px] text-slate-800">{order.notes}</p>
                  </div>
                )}

                <div className="pt-2 space-y-2">
                  <Link
                    href="/pages/account"
                    className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 rounded-sm text-[13px] transition"
                  >
                    Go to my account
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <Link
                    href="/pages/account/orders"
                    className="w-full inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]"
                  >
                    <Package className="w-3.5 h-3.5" />
                    View my orders
                  </Link>

                  <Link
                    href="/pages/products"
                    className="w-full inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]"
                  >
                    Continue shopping
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </section>

              {/* Trust */}
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

      {/* FOOTER */}
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

/* ---------- Sub-components ---------- */

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