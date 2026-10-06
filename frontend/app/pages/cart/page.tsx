// app/pages/cart/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Home,
  ChevronRight,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Tag,
  Truck,
  ArrowRight,
  ShieldCheck,
  Heart,
  X,
  Store,
  Zap,
  Smartphone,
  RotateCcw,
  CheckSquare,
  Square,
  AlertTriangle,
  StickyNote,
  Banknote,
  Loader2,
} from 'lucide-react';
import Header from '@/components/homepage/Navbar';
import Footer from '@/components/homepage/Footer';
import { useCart, type CartItem as LocalCartItem } from '@/lib/store/cart';
import {
  api,
  cartApi,
  checkoutApi,
  whatsappApi,
  ApiError,
  type Cart as ServerCart,
  type CartItem as ServerCartItem,
  type DeliveryMethod,
} from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Pricing config
//
// Sourced from `GET /api/v1/checkout/config/`. The endpoint returns
// BOTH express rates so the frontend can show the correct one based on
// auth state — plus `your_express_fee`, which is precomputed for the
// current caller.
//
// Tax shape
// ---------
// The API returns tax NESTED:
//   { tax: { enabled, rate, prices_include_tax } }
//
// The rate comes as a STRING percentage ("16"), not a decimal. This
// file normalises to a decimal (0.16) once, at parse time, so the rest
// of the math is in decimal form.
// ─────────────────────────────────────────────────────────────────────────────
interface CartConfig {
  deliveryFees: Record<DeliveryMethod, number>;
  freeDeliveryThreshold: number;
  taxEnabled: boolean;
  taxRate: number;              // decimal, e.g. 0.16
  pricesIncludeTax: boolean;
}

const DEFAULT_CONFIG: CartConfig = {
  deliveryFees: {
    express: 500, // guest rate
    standard: 300,
    pickup: 0,
  },
  freeDeliveryThreshold: 5000,
  taxEnabled: true,
  taxRate: 0.16,
  pricesIncludeTax: true,
};

function parseFeesFromConfig(raw: {
  delivery_fees?: {
    express_guest?: string;
    express_member?: string;
    standard?: string;
    pickup?: string;
  };
  your_express_fee?: string;
  free_delivery_threshold?: string;
  tax?: {
    enabled?: boolean;
    rate?: string | number;
    prices_include_tax?: boolean;
  };
  /** Legacy flat shape — supported for backward compatibility. */
  tax_rate?: string | number;
}): CartConfig {
  const parseNum = (s: string | number | undefined, fallback: number) => {
    if (s === undefined) return fallback;
    const n = typeof s === 'number' ? s : parseFloat(s);
    return Number.isFinite(n) ? n : fallback;
  };

  // ── Tax — try nested first, fall back to legacy flat ──
  let taxEnabled = DEFAULT_CONFIG.taxEnabled;
  let taxRate = DEFAULT_CONFIG.taxRate;
  let pricesIncludeTax = DEFAULT_CONFIG.pricesIncludeTax;

  if (raw.tax && (raw.tax.rate !== undefined || raw.tax.enabled !== undefined)) {
    taxEnabled = raw.tax.enabled ?? true;
    const rawRate = parseNum(raw.tax.rate, 16);
    // Normalise to decimal: "16" → 0.16. If the API ever returns a
    // decimal ("0.16"), leave it alone — anything > 1 is a percentage.
    taxRate = rawRate > 1 ? rawRate / 100 : rawRate;
    pricesIncludeTax = raw.tax.prices_include_tax ?? false;
  } else if (raw.tax_rate !== undefined) {
    const rawRate = parseNum(raw.tax_rate, 16);
    taxRate = rawRate > 1 ? rawRate / 100 : rawRate;
    pricesIncludeTax = false; // legacy shape assumed exclusive
  }

  return {
    deliveryFees: {
      // `your_express_fee` accounts for the caller's auth state.
      express: parseNum(
        raw.your_express_fee,
        DEFAULT_CONFIG.deliveryFees.express,
      ),
      standard: parseNum(
        raw.delivery_fees?.standard,
        DEFAULT_CONFIG.deliveryFees.standard,
      ),
      pickup: parseNum(
        raw.delivery_fees?.pickup,
        DEFAULT_CONFIG.deliveryFees.pickup,
      ),
    },
    freeDeliveryThreshold: parseNum(
      raw.free_delivery_threshold,
      DEFAULT_CONFIG.freeDeliveryThreshold,
    ),
    taxEnabled,
    taxRate,
    pricesIncludeTax,
  };
}

function formatKES(amount: number): string {
  if (!Number.isFinite(amount)) return 'KES 0';
  return `KES ${amount.toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified view model
// ─────────────────────────────────────────────────────────────────────────────
interface ViewItem {
  id: string;                    // local string id, or String(server id)
  productId: string;
  name: string;
  brand: string;
  image: string;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  stock: string;
  stockCount: number;
}

function fromLocal(item: LocalCartItem): ViewItem {
  return {
    id: item.id,
    productId: item.productId,
    name: item.name,
    brand: item.brand ?? '',
    image: item.image,
    unitPrice: item.unitPrice,
    compareAtPrice: item.compareAtPrice ?? null,
    quantity: item.quantity,
    stock: item.stock ?? '',
    stockCount: item.stockCount ?? 0,
  };
}

function fromServer(item: ServerCartItem): ViewItem {
  return {
    id: String(item.id),
    productId: item.productId,
    name: item.name,
    brand: item.brand ?? '',
    image: item.image,
    unitPrice: Number.parseFloat(item.unitPrice) || 0,
    compareAtPrice: item.compareAtPrice
      ? Number.parseFloat(item.compareAtPrice)
      : null,
    quantity: item.quantity,
    stock: item.stock ?? '',
    stockCount: item.stockCount ?? 0,
  };
}

export default function CartPage() {
  const router = useRouter();

  // ── Local (anonymous) source ──
  const localItems = useCart((s) => s.items);
  const localUpdateQty = useCart((s) => s.updateQty);
  const localRemoveItem = useCart((s) => s.removeItem);
  const localClear = useCart((s) => s.clear);

  // ── Auth state ──
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // ── Pricing config ──
  const [cartConfig, setCartConfig] = useState<CartConfig>(DEFAULT_CONFIG);
  const [configResolved, setConfigResolved] = useState(false);

  // ── Server cart state ──
  const [serverCart, setServerCart] = useState<ServerCart | null>(null);

  // ── UI state ──
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set());
  const [couponCode, setCouponCode] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<string>('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [couponMessage, setCouponMessage] = useState<string>('');
  const [couponValidating, setCouponValidating] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('standard');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── WhatsApp handoff state ──
  const [whatsappBusy, setWhatsappBusy] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState<{
    kind: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);

  // ── Fetch pricing config ──
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const cfg = await checkoutApi.config();
        if (cancelled) return;
        setCartConfig(parseFeesFromConfig(cfg));
      } catch {
        // Keep defaults.
      } finally {
        if (!cancelled) setConfigResolved(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Auth + initial server cart ──
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const me = await api.me();
        if (cancelled) return;

        const authed = !!me;
        setIsAuthed(authed);

        if (!authed) {
          setAuthChecked(true);
          return;
        }

        const localSnapshot = useCart.getState().items;

        try {
          const merged =
            localSnapshot.length > 0
              ? await cartApi.merge(
                localSnapshot.map((i) => ({
                  productId: i.productId,
                  name: i.name,
                  brand: i.brand,
                  image: i.image,
                  unitPrice: i.unitPrice,
                  compareAtPrice: i.compareAtPrice ?? null,
                  quantity: i.quantity,
                  stock: i.stock,
                  stockCount: i.stockCount,
                })),
              )
              : await cartApi.get();

          if (cancelled) return;
          setServerCart(merged);

          if (localSnapshot.length > 0) {
            useCart.getState().clear();
          }
        } catch (err) {
          console.error('Cart sync failed:', err);
          if (!cancelled) setLoadError(true);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Unified items for the UI ──
  const items: ViewItem[] = useMemo(() => {
    if (!authChecked) return [];
    if (isAuthed) {
      return serverCart ? serverCart.items.map(fromServer) : [];
    }
    return localItems.map(fromLocal);
  }, [authChecked, isAuthed, serverCart, localItems]);

  const isInitialLoading =
    !authChecked || (isAuthed && serverCart === null && !loadError);

  // ── Selection ──
  const isSelected = (id: string) => !deselectedIds.has(id);
  const selectedItems = items.filter((i) => isSelected(i.id));
  const allSelected = items.length > 0 && selectedItems.length === items.length;

  // ── Mutations ──
  const updateQty = useCallback(
    async (id: string, qty: number) => {
      if (qty < 1) return;
      setErrorMessage(null);

      if (isAuthed) {
        setBusyItemId(id);
        try {
          const updated = await cartApi.updateQty(Number(id), qty);
          setServerCart(updated);
        } catch {
          setErrorMessage('Could not update quantity. Please try again.');
        } finally {
          setBusyItemId(null);
        }
      } else {
        localUpdateQty(id, qty);
      }
    },
    [isAuthed, localUpdateQty],
  );

  const removeItem = useCallback(
    async (id: string) => {
      setErrorMessage(null);

      if (isAuthed) {
        setBusyItemId(id);
        try {
          const updated = await cartApi.removeItem(Number(id));
          setServerCart(updated);
        } catch {
          setErrorMessage('Could not remove item. Please try again.');
        } finally {
          setBusyItemId(null);
        }
      } else {
        localRemoveItem(id);
      }
    },
    [isAuthed, localRemoveItem],
  );

  const clearCart = useCallback(async () => {
    setErrorMessage(null);

    if (isAuthed) {
      setBusyAll(true);
      try {
        await cartApi.clear();
        setServerCart((prev) =>
          prev
            ? { ...prev, items: [], itemCount: 0, totalUnits: 0, subtotal: '0.00' }
            : null,
        );
      } catch {
        setErrorMessage('Could not clear cart. Please try again.');
      } finally {
        setBusyAll(false);
      }
    } else {
      localClear();
    }
  }, [isAuthed, localClear]);

  // ── UI event handlers ──
  const handleUpdateQuantity = (item: ViewItem, newQty: number): void => {
    if (newQty < 1) return;
    if (item.stockCount && newQty > item.stockCount) {
      alert(
        `Cannot add more. Maximum available stock for this item is ${item.stockCount}.`,
      );
      return;
    }
    void updateQty(item.id, newQty);
  };

  const handleRemoveItem = (id: string): void => {
    void removeItem(id);
    setDeselectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleToggleSelect = (id: string): void => {
    setDeselectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (): void => {
    if (allSelected) {
      setDeselectedIds(new Set(items.map((i) => i.id)));
    } else {
      setDeselectedIds(new Set());
    }
  };

  const handleRemoveSelected = (): void => {
    void Promise.all(selectedItems.map((i) => removeItem(i.id)));
    setDeselectedIds(new Set());
  };

  const handleClearCart = (): void => {
    if (confirm('Remove all items from your cart?')) {
      void clearCart();
      setDeselectedIds(new Set());
      setAppliedCoupon('');
      setAppliedDiscount(0);
      setCouponMessage('');
    }
  };

  // ── Coupon validation ──
  const handleApplyCoupon = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();

    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    const currentSubtotal = selectedItems.reduce(
      (acc, item) => acc + item.unitPrice * item.quantity,
      0,
    );

    setCouponValidating(true);
    setCouponMessage('');

    try {
      const result = await checkoutApi.validateCoupon(code, currentSubtotal);

      if (result.valid) {
        const pct = parseFloat(result.percent_off ?? '0');
        setAppliedDiscount(Number.isFinite(pct) ? pct : 0);
        setAppliedCoupon(result.code ?? code);
        setCouponMessage(result.message || 'Discount applied.');
      } else {
        setAppliedCoupon('');
        setAppliedDiscount(0);
        setCouponMessage(result.message || 'Invalid coupon code.');
      }
    } catch {
      setAppliedCoupon('');
      setAppliedDiscount(0);
      setCouponMessage('Could not validate the coupon. Please try again.');
    } finally {
      setCouponValidating(false);
    }
  };

  const handleRemoveCoupon = (): void => {
    setAppliedCoupon('');
    setAppliedDiscount(0);
    setCouponCode('');
    setCouponMessage('');
  };

  // ── Totals ──
  const subtotal = selectedItems.reduce<number>(
    (acc, item) => acc + item.unitPrice * item.quantity,
    0,
  );

  const discountAmount = subtotal * appliedDiscount;

  const shippingFee = (() => {
    if (deliveryMethod === 'pickup') return 0;
    if (subtotal === 0) return 0;
    if (subtotal >= cartConfig.freeDeliveryThreshold) return 0;
    return cartConfig.deliveryFees[deliveryMethod];
  })();

  // ── Tax + total — respecting prices_include_tax ──
  const { taxAmount, total } = useMemo(() => {
    const taxable = subtotal - discountAmount;
    let tax = 0;
    let tot = taxable + shippingFee;

    if (cartConfig.taxEnabled) {
      if (cartConfig.pricesIncludeTax) {
        // Extract VAT from the subtotal — total unchanged.
        tax = taxable * cartConfig.taxRate / (1 + cartConfig.taxRate);
      } else {
        // Add VAT on top.
        tax = taxable * cartConfig.taxRate;
        tot += tax;
      }
    }

    // NaN guard — if config was malformed, fall back to a safe total.
    if (!Number.isFinite(tot)) {
      // eslint-disable-next-line no-console
      console.error('Cart totals produced NaN — check config:', cartConfig);
      tot = taxable + shippingFee;
    }

    return { taxAmount: tax, total: tot };
  }, [subtotal, discountAmount, shippingFee, cartConfig]);

  const taxPercent = Math.round(cartConfig.taxRate * 100);

  const remainingForFreeShipping = Math.max(
    0,
    cartConfig.freeDeliveryThreshold - subtotal,
  );
  const freeShippingProgress = Math.min(
    100,
    (subtotal / cartConfig.freeDeliveryThreshold) * 100,
  );

  const estimatedDelivery = (() => {
    const today = new Date();
    const days =
      deliveryMethod === 'express' ? 1 : deliveryMethod === 'pickup' ? 0 : 3;
    today.setDate(today.getDate() + days);
    return today.toLocaleDateString('en-KE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  })();

  const handleCheckout = (): void => {
    if (selectedItems.length === 0) {
      alert('Please select at least one item to checkout.');
      return;
    }

    const params = new URLSearchParams();
    params.set('items', selectedItems.map((i) => i.id).join(','));
    params.set('delivery', deliveryMethod);
    if (appliedCoupon) params.set('coupon', appliedCoupon);
    if (orderNotes.trim()) params.set('notes', orderNotes.trim());

    router.push(`/pages/checkout?${params.toString()}`);
  };

  // ── WhatsApp handoff ──
  const handleWhatsAppOrder = async (): Promise<void> => {
    if (selectedItems.length === 0) {
      alert('Please select at least one item to send via WhatsApp.');
      return;
    }

    setWhatsappMessage(null);

    // ── Anonymous fallback ──
    if (!isAuthed) {
      const itemsText = selectedItems
        .map(
          (item) =>
            `• ${item.name} (x${item.quantity}) - ${formatKES(item.unitPrice * item.quantity)}`,
        )
        .join('%0A');

      const shippingText = shippingFee === 0 ? 'FREE' : formatKES(shippingFee);

      const message = `Hello! I would like to place an order:%0A%0A${itemsText}%0A%0ASubtotal: ${formatKES(
        subtotal,
      )}%0ADiscount: -${formatKES(discountAmount)}%0AShipping (${deliveryMethod}): ${shippingText}%0AVAT (${taxPercent}%): ${formatKES(
        taxAmount,
      )}%0A%0A*Total: ${formatKES(total)}*${orderNotes ? `%0A%0ANotes: ${encodeURIComponent(orderNotes)}` : ''
        }`;

      window.open(`https://wa.me/254712345678?text=${message}`, '_blank');
      return;
    }

    // ── Authenticated handoff ──
    setWhatsappBusy(true);

    try {
      const result = await whatsappApi.cartHandoff({
        items: selectedItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
        delivery: deliveryMethod,
        coupon: appliedCoupon || null,
        notes: orderNotes.trim() || null,
      });

      switch (result.status) {
        case 'sent':
          setWhatsappMessage({
            kind: 'success',
            text:
              result.message ||
              'Cart sent to your WhatsApp. Tap the link there to continue.',
          });
          break;

        case 'fallback':
          if (result.checkout_url) {
            window.open(result.checkout_url, '_blank', 'noopener,noreferrer');
          }
          setWhatsappMessage({
            kind: 'info',
            text:
              result.message ||
              'Opening secure web checkout to complete your order…',
          });
          break;

        case 'unverified':
          setWhatsappMessage({
            kind: 'error',
            text:
              result.message ||
              'Verify your WhatsApp number in account settings to continue.',
          });
          break;

        case 'disabled':
          setWhatsappMessage({
            kind: 'error',
            text:
              result.message ||
              'WhatsApp checkout is currently unavailable. Please use web checkout.',
          });
          break;

        default:
          setWhatsappMessage({
            kind: 'info',
            text: result.message || 'WhatsApp handoff completed.',
          });
      }
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 409 &&
        err.code === 'UNVERIFIED'
      ) {
        setWhatsappMessage({
          kind: 'error',
          text:
            'Verify your WhatsApp number in account settings to continue.',
        });
      } else if (err instanceof ApiError && err.status === 401) {
        setWhatsappMessage({
          kind: 'error',
          text: 'Please sign in again to use WhatsApp checkout.',
        });
      } else {
        setWhatsappMessage({
          kind: 'error',
          text: 'Could not start WhatsApp checkout. Please try again.',
        });
      }
    } finally {
      setWhatsappBusy(false);
    }
  };

  const totalUnits = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Header />

      <main className="max-w-6xl mx-auto px-3 py-3 space-y-3">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-xs text-slate-500">
          <Link href="/" className="hover:text-slate-900 flex items-center space-x-1">
            <Home className="w-3.5 h-3.5" />
            <span>Home</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-900 font-medium">Shopping Cart</span>
        </nav>

        {/* Cart Header */}
        <div className="bg-white border border-slate-200 rounded-sm px-3 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Shopping cart</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Manage your selected items and proceed to secure checkout.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={handleClearCart}
                disabled={busyAll}
                className="text-[13px] font-medium text-red-600 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
                Clear cart
              </button>
            )}
            <span className="text-[13px] font-medium bg-blue-50 text-blue-950 px-2 py-0.5 rounded-sm border border-blue-100">
              {totalUnits} item{totalUnits !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Error banner */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-100 rounded-sm px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-[13px] text-red-700">{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-700"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isInitialLoading ? (
          <div className="bg-white border border-slate-200 rounded-sm py-16 flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            <p className="text-[13px] text-slate-500">Loading your cart…</p>
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
            {/* LEFT — items, promo, delivery */}
            <div className="lg:col-span-8 space-y-3">
              {/* Free shipping progress bar */}
              <div className="bg-white border border-slate-200 rounded-sm p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] text-slate-700">
                    {remainingForFreeShipping > 0 ? (
                      <>
                        Add{' '}
                        <span className="font-semibold text-slate-900">
                          {formatKES(remainingForFreeShipping)}
                        </span>{' '}
                        more for free delivery
                      </>
                    ) : (
                      <span className="text-emerald-700 font-medium">
                        You&apos;ve unlocked free delivery
                      </span>
                    )}
                  </p>
                  <Truck className="w-3.5 h-3.5 text-blue-950 shrink-0" />
                </div>
                <div className="h-1.5 rounded-sm bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full transition-all ${freeShippingProgress >= 100 ? 'bg-emerald-500' : 'bg-blue-950'
                      }`}
                    style={{ width: `${freeShippingProgress}%` }}
                  />
                </div>
              </div>

              {/* Bulk actions bar */}
              <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between gap-2">
                <button
                  onClick={handleSelectAll}
                  className="inline-flex items-center gap-2 text-[13px] text-slate-700 hover:text-slate-900"
                >
                  {allSelected ? (
                    <CheckSquare className="w-4 h-4 text-blue-950" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Select all</span>
                </button>
                {selectedItems.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-slate-500">
                      {selectedItems.length} selected
                    </span>
                    <button
                      onClick={handleRemoveSelected}
                      className="text-[13px] font-medium text-red-600 hover:underline inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Items list */}
              <div className="bg-white border border-slate-200 rounded-sm divide-y divide-slate-100">
                {items.map((item) => {
                  const isLowStock = item.stockCount > 0 && item.stockCount <= 3;
                  const isBusy = busyItemId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${isBusy ? 'opacity-50' : 'hover:bg-slate-50/50'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          onClick={() => handleToggleSelect(item.id)}
                          className="shrink-0"
                          aria-label="Select item"
                        >
                          {isSelected(item.id) ? (
                            <CheckSquare className="w-4 h-4 text-blue-950" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        <Link
                          href={`/pages/products?open=${item.productId}`}
                          className="w-16 h-16 rounded-sm bg-slate-100 overflow-hidden shrink-0 border border-slate-200 block"
                        >
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </Link>
                        <div className="space-y-0.5 min-w-0">
                          {item.brand && (
                            <span className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">
                              {item.brand}
                            </span>
                          )}
                          <Link href={`/pages/products?open=${item.productId}`}>
                            <h3 className="text-[13px] font-semibold text-slate-900 hover:text-blue-950 transition truncate">
                              {item.name}
                            </h3>
                          </Link>
                          {item.stock && (
                            <p
                              className={`text-[13px] font-medium inline-flex items-center gap-1 ${isLowStock ? 'text-amber-600' : 'text-emerald-600'
                                }`}
                            >
                              {isLowStock && <AlertTriangle className="w-3 h-3" />}
                              {item.stock}
                              {item.stockCount > 0 && ` • Max ${item.stockCount}`}
                            </p>
                          )}
                          <div className="flex items-baseline gap-2 pt-0.5">
                            <span className="text-[13px] font-bold text-slate-900">
                              {formatKES(item.unitPrice)}
                            </span>
                            {item.compareAtPrice && (
                              <span className="text-[13px] text-slate-400 line-through">
                                {formatKES(item.compareAtPrice)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 gap-3">
                        <button
                          onClick={() => {
                            handleRemoveItem(item.id);
                            alert(`"${item.name}" saved to your wishlist.`);
                          }}
                          disabled={isBusy}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-sm hover:bg-rose-50 transition disabled:opacity-50"
                          title="Save for later"
                        >
                          <Heart className="w-4 h-4" />
                        </button>

                        <div className="flex items-center border border-slate-200 rounded-sm overflow-hidden bg-white">
                          <button
                            onClick={() =>
                              handleUpdateQuantity(item, item.quantity - 1)
                            }
                            disabled={isBusy || item.quantity <= 1}
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 transition disabled:opacity-50"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-[13px] font-semibold text-slate-900">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              handleUpdateQuantity(item, item.quantity + 1)
                            }
                            disabled={
                              isBusy ||
                              (item.stockCount > 0 &&
                                item.quantity >= item.stockCount)
                            }
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 transition disabled:opacity-50"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="text-right min-w-[90px]">
                          <span className="text-[13px] font-bold text-slate-900">
                            {formatKES(item.unitPrice * item.quantity)}
                          </span>
                        </div>

                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={isBusy}
                          className="text-slate-400 hover:text-red-600 p-1.5 rounded-sm hover:bg-red-50 transition disabled:opacity-50"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Link
                href="/pages/products"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-950 hover:underline"
              >
                <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                Continue shopping
              </Link>

              {/* Promo code */}
              <div className="bg-white border border-slate-200 rounded-sm p-3 space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-medium text-[13px]">
                  <Tag className="w-3.5 h-3.5 text-blue-950" />
                  <span>Have a promo code?</span>
                </div>

                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-sm px-2 py-1.5">
                    <span className="text-[13px] font-medium text-emerald-700">
                      {appliedCoupon} applied — {Math.round(appliedDiscount * 100)}% off
                    </span>
                    <button
                      onClick={handleRemoveCoupon}
                      className="text-emerald-700 hover:text-emerald-900 p-1"
                      aria-label="Remove coupon"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={handleApplyCoupon}
                    className="flex flex-col sm:flex-row items-stretch gap-2"
                  >
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="Enter coupon code"
                      disabled={couponValidating}
                      className="flex-1 bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                    <button
                      type="submit"
                      disabled={couponValidating || !couponCode.trim()}
                      className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                    >
                      {couponValidating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Checking…
                        </>
                      ) : (
                        'Apply'
                      )}
                    </button>
                  </form>
                )}

                {couponMessage && (
                  <p
                    className={`text-[13px] font-medium ${appliedDiscount > 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}
                  >
                    {couponMessage}
                  </p>
                )}
              </div>

              {/* Delivery method */}
              <div className="bg-white border border-slate-200 rounded-sm p-3 space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-medium text-[13px]">
                  <Truck className="w-3.5 h-3.5 text-blue-950" />
                  <span>Delivery method</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      {
                        id: 'standard' as const,
                        label: 'Standard',
                        sub: '3–5 days',
                        price: cartConfig.deliveryFees.standard,
                        icon: Truck,
                      },
                      {
                        id: 'express' as const,
                        label: 'Express',
                        sub: '24–48 hours',
                        price: cartConfig.deliveryFees.express,
                        icon: Zap,
                      },
                      {
                        id: 'pickup' as const,
                        label: 'Store pickup',
                        sub: 'Ready in 1h',
                        price: cartConfig.deliveryFees.pickup,
                        icon: Store,
                      },
                    ]
                  ).map(({ id, label, sub, price, icon: Icon }) => {
                    const active = deliveryMethod === id;
                    const freeForOrder =
                      id !== 'pickup' &&
                      subtotal > 0 &&
                      subtotal >= cartConfig.freeDeliveryThreshold;

                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setDeliveryMethod(id)}
                        className={`p-2 rounded-sm border text-left transition flex items-start gap-2 ${active
                          ? 'border-blue-950 bg-blue-50'
                          : 'border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        <Icon
                          className={`w-4 h-4 mt-0.5 shrink-0 ${active ? 'text-blue-950' : 'text-slate-400'
                            }`}
                        />
                        <div className="min-w-0">
                          <p
                            className={`text-[13px] font-medium ${active ? 'text-blue-950' : 'text-slate-800'
                              }`}
                          >
                            {label}
                          </p>
                          <p className="text-[13px] text-slate-500 mt-0.5">
                            {sub}
                          </p>
                          <p className="text-[13px] font-medium text-slate-900 mt-0.5">
                            {price === 0 || freeForOrder
                              ? 'Free'
                              : formatKES(price)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[13px] text-slate-500 pt-1">
                  Estimated arrival:{' '}
                  <span className="font-medium text-slate-900">
                    {estimatedDelivery}
                  </span>
                </p>
                {subtotal > 0 && subtotal < cartConfig.freeDeliveryThreshold && (
                  <p className="text-[13px] text-slate-400">
                    Free delivery on orders over {formatKES(cartConfig.freeDeliveryThreshold)}
                  </p>
                )}
              </div>

              {/* Order notes */}
              <div className="bg-white border border-slate-200 rounded-sm p-3 space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-medium text-[13px]">
                  <StickyNote className="w-3.5 h-3.5 text-blue-950" />
                  <span>Order notes (optional)</span>
                </div>
                <textarea
                  rows={2}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Delivery instructions, gift message, preferred time…"
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </div>
            </div>

            {/* RIGHT — summary */}
            <div className="lg:col-span-4 space-y-3">
              <div className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                <h2 className="text-[15px] font-semibold text-slate-900 pb-2 border-b border-slate-100">
                  Order summary
                </h2>

                <div className="space-y-2 text-[13px] text-slate-600">
                  <div className="flex justify-between">
                    <span>
                      Subtotal ({selectedItems.length} item
                      {selectedItems.length !== 1 ? 's' : ''})
                    </span>
                    <span className="font-medium text-slate-900">
                      {formatKES(subtotal)}
                    </span>
                  </div>
                  {appliedDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Discount ({Math.round(appliedDiscount * 100)}%)</span>
                      <span>- {formatKES(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Delivery</span>
                    <span className="font-medium text-slate-900">
                      {shippingFee === 0 ? 'Free' : formatKES(shippingFee)}
                    </span>
                  </div>
                  {cartConfig.taxEnabled && (
                    <div className="flex justify-between">
                      <span>
                        VAT ({taxPercent}%
                        {cartConfig.pricesIncludeTax ? ' included' : ''})
                      </span>
                      <span className="font-medium text-slate-900">
                        {formatKES(taxAmount)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-slate-900">
                    Total
                  </span>
                  <span className="text-[15px] font-bold text-slate-900">
                    {formatKES(total)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={selectedItems.length === 0}
                  className="w-full bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-4 rounded-sm text-[13px] transition flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Proceed to checkout</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {/* Payment method icons */}
                <div className="flex items-center justify-center gap-2 pt-1">
                  <PaymentChip
                    icon={<Smartphone className="w-3.5 h-3.5" />}
                    label="M-Pesa"
                  />
                  <PaymentChip
                    icon={<Banknote className="w-3.5 h-3.5" />}
                    label="Pay on delivery"
                  />
                </div>

                {/* WhatsApp handoff */}
                <button
                  type="button"
                  onClick={() => {
                    void handleWhatsAppOrder();
                  }}
                  disabled={selectedItems.length === 0 || whatsappBusy}
                  className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium py-2 px-4 rounded-sm text-[13px] transition flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {whatsappBusy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending…</span>
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      <span>Continue with WhatsApp</span>
                    </>
                  )}
                </button>

                {/* WhatsApp handoff feedback */}
                {whatsappMessage && (
                  <div
                    className={`flex items-start justify-between gap-2 rounded-sm border px-2 py-1.5 ${whatsappMessage.kind === 'success'
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                      : whatsappMessage.kind === 'error'
                        ? 'bg-red-50 border-red-100 text-red-700'
                        : 'bg-blue-50 border-blue-100 text-blue-800'
                      }`}
                  >
                    <span className="text-[13px] leading-snug">
                      {whatsappMessage.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => setWhatsappMessage(null)}
                      className="shrink-0 opacity-70 hover:opacity-100"
                      aria-label="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Trust row */}
                <div className="flex flex-col items-center gap-1.5 pt-1">
                  <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>256-bit SSL secure checkout</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                    <span>30-day hassle-free returns</span>
                  </div>
                </div>
              </div>

              {/* Continue shopping (mobile) */}
              <Link
                href="/pages/products"
                className="lg:hidden inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-950 hover:underline"
              >
                <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                Continue shopping
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 bg-white border border-slate-200 rounded-sm space-y-3">
            <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <h3 className="text-[15px] font-semibold text-slate-900">
              Your cart is empty
            </h3>
            <p className="text-[13px] text-slate-500 max-w-xs mx-auto">
              Explore our catalog of certified electronics to add items to your cart.
            </p>
            <div>
              <Link
                href="/pages/products"
                className="inline-flex items-center justify-center bg-blue-950 text-white font-medium py-2 px-4 rounded-sm text-[13px] hover:bg-blue-900 transition"
              >
                Browse products
              </Link>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

/* ───── Payment chip ───── */
function PaymentChip({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[13px] text-slate-600 bg-white border border-slate-200 rounded-sm px-2 py-1">
      {icon}
      {label}
    </span>
  );
}