// app/pages/checkout/page.tsx
'use client';

import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  Suspense,
  useCallback,
} from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  CreditCard,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Store,
  Truck,
  Zap,
  Tag,
  X,
  Lock,
  RotateCcw,
  MapPin,
  Phone,
  Mail,
  User,
  ChevronDown,
  StickyNote,
  Banknote,
  Wallet,
  ShoppingCart,
  RefreshCw,
} from 'lucide-react';
import { useCart } from '@/lib/store/cart';
import {
  api,
  cartApi,
  checkoutApi,
  paymentsApi,
  pollPayment,
  ApiError,
  type Payment,
  type Me,
  type CheckoutPayload,
  type CheckoutConfig,
  type Cart as ServerCart,
} from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type PaymentChoice = 'pay-on-delivery' | 'pay-now';
type PayNowMethod = 'mpesa';
type DeliveryMethod = 'express' | 'standard' | 'pickup';
type Step = 1 | 2;
type Phase = 'idle' | 'submitting' | 'awaiting-pin' | 'failed';

interface CheckoutItem {
  id: string;
  productId: string;
  name: string;
  brand: string;
  price: number;
  quantity: number;
  image: string;
}

interface OrderDraft {
  orderReference: string | null;
  date: string;
  total: number;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  paymentLabel: string;
  deliveryMethod: DeliveryMethod;
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
  items: CheckoutItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback constants — used only when /checkout/config/ hasn't loaded yet
// or fails. If any of these disagree with the shop's real settings, the
// backend will reject the order with a pricing_mismatch, which is the
// correct behavior (never silently accept a wrong total).
// ─────────────────────────────────────────────────────────────────────────────
const FALLBACK_COUNTIES = [
  'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Kiambu', 'Machakos',
  'Kajiado', 'Uasin Gishu', 'Kakamega', 'Meru', 'Nyeri', 'Kilifi',
];

const FALLBACK_DELIVERY_FEES: Record<DeliveryMethod, number> = {
  express: 500,
  standard: 300,
  pickup: 0,
};

const FALLBACK_FREE_DELIVERY_THRESHOLD = 5000;
const FALLBACK_TAX_RATE_DECIMAL = 0.16;  // 16% as a decimal
const FALLBACK_PRICES_INCLUDE_TAX = true;

const SESSION_KEY = 'checkout:form:v4';
const ORDER_KEY_PREFIX = 'order:';

const EMAIL_RE = /\S+@\S+\.\S+/;

function formatKES(n: number | string): string {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (!Number.isFinite(num)) return 'KES 0';
  return `KES ${num.toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function describeStatus(status: string): string {
  switch (status) {
    case 'TIMEOUT':
      return 'The M-Pesa request timed out. You can try again.';
    case 'CANCELLED':
      return 'The payment was cancelled.';
    case 'FAILED':
      return 'The M-Pesa request was not completed.';
    default:
      return '';
  }
}

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return 'Network error. Check your connection.';
    if (err.status === 400) return err.message || 'Please check your details.';
    if (err.status === 409)
      return 'A payment for this order is already in progress.';
    if (err.status === 502)
      return err.message || 'Could not reach M-Pesa. Please try again.';
    if (err.status >= 500)
      return 'Something went wrong on our side. Please try again.';
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalised tax config
//
// Reads whatever shape the API returns and normalises to a single object.
// Handles the current nested shape (`config.tax.rate`) and a legacy flat
// shape (`config.tax_rate`) so nothing crashes during a rollout.
//
// The rate is normalised to a DECIMAL (0.16 for 16%), not a percentage.
// All downstream math uses the decimal form.
// ─────────────────────────────────────────────────────────────────────────────
interface NormalisedTaxConfig {
  enabled: boolean;
  rate: number;             // decimal, e.g. 0.16
  pricesIncludeTax: boolean;
}

function normaliseTaxConfig(config: CheckoutConfig | null): NormalisedTaxConfig {
  if (!config) {
    return {
      enabled: true,
      rate: FALLBACK_TAX_RATE_DECIMAL,
      pricesIncludeTax: FALLBACK_PRICES_INCLUDE_TAX,
    };
  }

  // Nested shape — the current API contract.
  const cfg = config as unknown as {
    tax?: { enabled?: boolean; rate?: string | number; prices_include_tax?: boolean };
    tax_rate?: string | number;
  };

  if (cfg.tax && (cfg.tax.rate !== undefined || cfg.tax.enabled !== undefined)) {
    const rawRate = Number(cfg.tax.rate ?? 0);
    return {
      enabled: cfg.tax.enabled ?? true,
      // If the API ever returns 16 instead of "16", divide by 100 to
      // keep the decimal contract. If it returns "0.16", leave it alone.
      rate: rawRate > 1 ? rawRate / 100 : rawRate,
      pricesIncludeTax: cfg.tax.prices_include_tax ?? false,
    };
  }

  // Legacy flat shape.
  const legacyRate = Number(cfg.tax_rate ?? 0);
  return {
    enabled: true,
    rate: legacyRate > 1 ? legacyRate / 100 : legacyRate,
    pricesIncludeTax: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Outer — Suspense for useSearchParams
// ─────────────────────────────────────────────────────────────────────────────
export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-[13px] text-slate-500">
          Loading checkout…
        </div>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner
// ─────────────────────────────────────────────────────────────────────────────
function CheckoutInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const localCartItems = useCart((s) => s.items);
  const localClearCart = useCart((s) => s.clear);

  const itemIds = useMemo(() => {
    const raw = searchParams.get('items');
    return raw ? raw.split(',').filter(Boolean) : [];
  }, [searchParams]);

  const urlDelivery = searchParams.get('delivery');
  const urlCoupon = searchParams.get('coupon');
  const urlNotes = searchParams.get('notes') ?? '';

  // ── UI state ──
  const [step, setStep] = useState<Step>(1);
  const [phase, setPhase] = useState<Phase>('idle');
  const [me, setMe] = useState<Me | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [serverCart, setServerCart] = useState<ServerCart | null>(null);
  const [cartResolved, setCartResolved] = useState(false);
  const [config, setConfig] = useState<CheckoutConfig | null>(null);
  const [configResolved, setConfigResolved] = useState(false);

  // ── Form ──
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    contactPhone: '',
    county: 'Nairobi',
    town: '',
    street: '',
    postalCode: '',
    deliveryMethod: 'express' as DeliveryMethod,
    paymentChoice: 'pay-now' as PaymentChoice,
    payNowMethod: 'mpesa' as PayNowMethod,
    mpesaPhone: '',
    orderNotes: urlNotes,
    agreeTerms: false,
    subscribe: true,
  });

  // ── Coupon ──
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [appliedDiscountPct, setAppliedDiscountPct] = useState(0);
  const [couponMessage, setCouponMessage] = useState('');
  const [couponValid, setCouponValid] = useState(false);
  const [couponChecking, setCouponChecking] = useState(false);

  // ── Submit / payment state ──
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [orderDraft, setOrderDraft] = useState<OrderDraft | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);

  // ── Refs ──
  const paymentAbortRef = useRef<AbortController | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // ═════════════════════════════════════════════════════════════════════════
  // ALL HOOKS BELOW — no early returns before this block finishes.
  // ═════════════════════════════════════════════════════════════════════════

  // ── Live config ──
  useEffect(() => {
    let cancelled = false;
    checkoutApi
      .config()
      .then((cfg) => {
        if (!cancelled) setConfig(cfg);
      })
      .catch(() => {
        /* fall back to FALLBACK_* constants — never block the page */
      })
      .finally(() => {
        if (!cancelled) setConfigResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Derived: live values ──
  const counties = config?.counties ?? FALLBACK_COUNTIES;

  const expressFee = useMemo(() => {
    if (!config) return FALLBACK_DELIVERY_FEES.express;
    return me
      ? Number(config.delivery_fees.express_member)
      : Number(config.delivery_fees.express_guest);
  }, [config, me]);

  const deliveryFees: Record<DeliveryMethod, number> = useMemo(
    () => ({
      express: expressFee,
      standard: config
        ? Number(config.delivery_fees.standard)
        : FALLBACK_DELIVERY_FEES.standard,
      pickup: config
        ? Number(config.delivery_fees.pickup)
        : FALLBACK_DELIVERY_FEES.pickup,
    }),
    [config, expressFee],
  );

  const freeDeliveryThreshold = config
    ? Number(config.free_delivery_threshold)
    : FALLBACK_FREE_DELIVERY_THRESHOLD;

  // ── Normalised tax config ──
  // Single source of truth for tax math. Reads from the API response
  // via `normaliseTaxConfig()` which handles both nested and flat shapes.
  const taxConfig: NormalisedTaxConfig = useMemo(
    () => normaliseTaxConfig(config),
    [config],
  );

  // ── Restore form from sessionStorage ──
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setFormData((p) => ({ ...p, ...saved }));
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(formData));
    } catch {
      /* quota, ignore */
    }
  }, [formData, hydrated]);

  // ── Resolve auth + load server cart ──
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const user = await api.me();
        if (cancelled) return;

        setMe(user);
        setAuthResolved(true);

        if (!user) {
          setCartResolved(true);
          return;
        }

        const localSnapshot = useCart.getState().items;

        try {
          const cart =
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
          setServerCart(cart);

          if (localSnapshot.length > 0) {
            useCart.getState().clear();
          }
        } catch {
          /* fall through — the empty-cart guard will render */
        }
      } finally {
        if (!cancelled) {
          setAuthResolved(true);
          setCartResolved(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Resolve checkout items ──
  const checkoutItems: CheckoutItem[] = useMemo(() => {
    if (me && serverCart) {
      const source =
        itemIds.length > 0
          ? serverCart.items.filter((i) => itemIds.includes(String(i.id)))
          : serverCart.items;

      return source.map((i) => ({
        id: String(i.id),
        productId: i.productId,
        name: i.name,
        brand: i.brand ?? '',
        price: Number.parseFloat(i.unitPrice) || 0,
        quantity: i.quantity,
        image: i.image,
      }));
    }

    const source =
      itemIds.length > 0
        ? localCartItems.filter((i) => itemIds.includes(i.id))
        : localCartItems;

    return source.map((i) => ({
      id: i.id,
      productId: i.productId,
      name: i.name,
      brand: i.brand ?? '',
      price: i.unitPrice,
      quantity: i.quantity,
      image: i.image,
    }));
  }, [me, serverCart, localCartItems, itemIds]);

  // ── Totals ──
  const subtotal = useMemo(
    () =>
      round2(
        checkoutItems.reduce((acc, i) => acc + i.price * i.quantity, 0),
      ),
    [checkoutItems],
  );

  const discountAmount = round2(subtotal * appliedDiscountPct);

  const shippingFee = useMemo(() => {
    if (formData.deliveryMethod === 'pickup') return 0;
    if (subtotal - discountAmount >= freeDeliveryThreshold) return 0;
    return deliveryFees[formData.deliveryMethod];
  }, [formData.deliveryMethod, subtotal, discountAmount, freeDeliveryThreshold, deliveryFees]);

  // ── Tax + total — RESPECTING prices_include_tax ──
  //
  // When `pricesIncludeTax = true`, the shop's display prices already
  // contain VAT. The `tax` line is a BREAKDOWN (extracted from the
  // subtotal), not an addition. Adding it again would double-count.
  //
  // When `pricesIncludeTax = false`, VAT is added on top of the subtotal.
  //
  // This mirrors `checkout/services.py::recompute_totals` exactly. Any
  // divergence here produces a pricing_mismatch from the backend.
  const { taxAmount, totalAmount } = useMemo(() => {
    const taxable = subtotal - discountAmount;
    let tax = 0;
    let total = taxable + shippingFee;

    if (taxConfig.enabled) {
      if (taxConfig.pricesIncludeTax) {
        // Extract VAT from the subtotal — total unchanged.
        tax = round2(taxable * taxConfig.rate / (1 + taxConfig.rate));
      } else {
        // Add VAT on top of the subtotal.
        tax = round2(taxable * taxConfig.rate);
        total += tax;
      }
    }

    // Flat transaction fee — 0 unless the shop owner set one.
    const txnFee = config?.checkout?.transaction_fee_kes
      ? Number(config.checkout.transaction_fee_kes)
      : 0;
    total += txnFee;

    // Final safety net — if any read produced NaN (e.g. malformed
    // config), fall back to the sum of known parts. Better to send a
    // wrong total than a NaN the backend cannot parse.
    if (!Number.isFinite(total)) {
      // eslint-disable-next-line no-console
      console.error('Checkout totals produced NaN — check config shape:', {
        config,
        taxConfig,
        subtotal,
        discountAmount,
        shippingFee,
      });
      total = taxable + shippingFee;
    }

    return { taxAmount: tax, totalAmount: round2(total) };
  }, [subtotal, discountAmount, shippingFee, taxConfig, config]);

  // ── Coupon validator ──
  const applyCouponCode = useCallback(
    async (code: string, silent = false) => {
      const trimmed = code.trim().toUpperCase();
      if (!trimmed) return;

      setCouponChecking(true);
      try {
        const result = await checkoutApi.validateCoupon(trimmed, subtotal);

        if (result.valid && result.percent_off) {
          const pct = Number(result.percent_off);
          setAppliedDiscountPct(Number.isFinite(pct) ? pct : 0);
          setAppliedCoupon(result.code || trimmed);
          setCouponMessage(result.message);
          setCouponValid(true);
        } else {
          setAppliedCoupon('');
          setAppliedDiscountPct(0);
          setCouponMessage(result.message || 'Invalid coupon code');
          setCouponValid(false);
        }
      } catch (err) {
        setAppliedCoupon('');
        setAppliedDiscountPct(0);
        setCouponValid(false);
        setCouponMessage(
          err instanceof ApiError
            ? err.message
            : 'Could not validate coupon.',
        );
      } finally {
        setCouponChecking(false);
        void silent;
      }
    },
    [subtotal],
  );

  // ── Auto-apply coupon from URL ──
  useEffect(() => {
    if (!urlCoupon) return;
    void applyCouponCode(urlCoupon, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Prefill identity fields from the signed-in account ──
  useEffect(() => {
    if (!hydrated || !me) return;
    setFormData((p) => ({
      ...p,
      email: p.email || me.email || '',
      fullName:
        p.fullName ||
        `${me.first_name ?? ''} ${me.last_name ?? ''}`.trim() ||
        '',
      contactPhone: p.contactPhone || me.phone || '',
    }));
  }, [hydrated, me]);

  // ── Hydrate delivery method from URL ──
  useEffect(() => {
    if (
      urlDelivery === 'express' ||
      urlDelivery === 'standard' ||
      urlDelivery === 'pickup'
    ) {
      setFormData((p) => ({ ...p, deliveryMethod: urlDelivery }));
    }
  }, [urlDelivery]);

  // ── Warn before leaving while waiting for PIN ──
  useEffect(() => {
    if (phase !== 'awaiting-pin') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  // ── Cleanup abort on unmount ──
  useEffect(() => {
    return () => {
      paymentAbortRef.current?.abort();
    };
  }, []);

  // ═════════════════════════════════════════════════════════════════════════
  // END OF HOOKS. Early returns are safe below this point.
  // ═════════════════════════════════════════════════════════════════════════

  const isResolving = !authResolved || !cartResolved || !configResolved;

  if (isResolving) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (checkoutItems.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex items-center justify-center p-3">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-sm p-6 text-center space-y-3">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <h1 className="text-[15px] font-semibold text-slate-900">
            Nothing to check out
          </h1>
          <p className="text-[13px] text-slate-500">
            Your cart is empty or the selected items are no longer available.
          </p>
          <Link
            href="/pages/cart"
            className="inline-block bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-4 rounded-sm text-[13px] transition"
          >
            Back to cart
          </Link>
        </div>
      </div>
    );
  }

  // ── Pure derivations (no hooks) — safe after the early returns ──
  const estimatedDelivery = (() => {
    const d = new Date();
    const days = config?.delivery_days
      ? config.delivery_days[formData.deliveryMethod] ?? 0
      : formData.deliveryMethod === 'express'
        ? 1
        : formData.deliveryMethod === 'pickup'
          ? 0
          : 3;
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('en-KE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  })();

  const paymentLabel =
    formData.paymentChoice === 'pay-on-delivery' ? 'Cash on delivery' : 'M-PESA';

  // ── Handlers ──
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (errorMessage) setErrorMessage('');
  };

  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!EMAIL_RE.test(formData.email.trim())) {
      errors.email = 'Enter a valid email';
    }
    if (!formData.fullName.trim())
      errors.fullName = 'Full name is required';
    if (!formData.contactPhone.trim())
      errors.contactPhone = 'Contact phone is required';
    if (!formData.street.trim()) errors.street = 'Street address is required';
    if (!formData.town.trim()) errors.town = 'Town / city is required';
    if (!formData.county.trim()) errors.county = 'County is required';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = () => {
    const errors: Record<string, string> = {};
    if (formData.paymentChoice === 'pay-now') {
      const mpesa = formData.mpesaPhone.trim() || formData.contactPhone.trim();
      if (!mpesa) errors.mpesaPhone = 'M-Pesa phone number is required';
    }
    if (!formData.agreeTerms) errors.agreeTerms = 'You must accept the terms';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateAll = () => {
    const step1Ok = validateStep1();
    const step2Ok = validateStep2();
    if (!step1Ok) {
      setStep(1);
      return false;
    }
    if (!step2Ok) {
      setStep(2);
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (step === 1 && !validateStep1()) return;
    setErrorMessage('');
    setStep((prev) => (prev < 2 ? ((prev + 1) as Step) : prev));
  };

  const goBack = () => {
    if (phase !== 'idle') return;
    setErrorMessage('');
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  };

  const handleApplyCoupon = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    void applyCouponCode(couponCode);
  };

  const removeCoupon = () => {
    setAppliedCoupon('');
    setAppliedDiscountPct(0);
    setCouponCode('');
    setCouponMessage('');
    setCouponValid(false);
  };

  // ── Build draft + payload ──
  const buildOrderDraft = (): OrderDraft => ({
    orderReference: null,
    date: new Date().toISOString(),
    total: totalAmount,
    subtotal,
    discount: discountAmount,
    shipping: shippingFee,
    tax: taxAmount,
    paymentLabel,
    deliveryMethod: formData.deliveryMethod,
    estimatedDelivery,
    coupon: appliedCoupon || null,
    notes: formData.orderNotes.trim() || null,
    customer: {
      email: formData.email.trim(),
      phone: formData.contactPhone.trim(),
      fullName: formData.fullName.trim(),
      address: {
        street: formData.street.trim(),
        town: formData.town.trim(),
        county: formData.county.trim(),
        postalCode: formData.postalCode.trim(),
      },
    },
    items: checkoutItems,
  });

  const buildCheckoutPayload = (draft: OrderDraft): CheckoutPayload => ({
    email: draft.customer.email,
    phone: draft.customer.phone,
    full_name: draft.customer.fullName,
    address: {
      street: draft.customer.address.street,
      town: draft.customer.address.town,
      county: draft.customer.address.county,
      postal_code: draft.customer.address.postalCode,
    },
    delivery_method: draft.deliveryMethod,
    estimated_delivery: draft.estimatedDelivery,
    coupon: draft.coupon,
    notes: draft.notes,
    items: draft.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      brand: i.brand,
      price: i.price,
      quantity: i.quantity,
      image: i.image,
    })),
    totals: {
      subtotal: draft.subtotal,
      discount: draft.discount,
      shipping: draft.shipping,
      tax: draft.tax,
      total: draft.total,
    },
  });

  const saveDraft = (draft: OrderDraft, reference: string) => {
    try {
      sessionStorage.setItem(
        `${ORDER_KEY_PREFIX}${reference}`,
        JSON.stringify({ ...draft, orderReference: reference }),
      );
    } catch {
      /* quota, ignore */
    }
  };

  // ── Submit ──
  const handlePlaceOrder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void submit();
  };

  const submit = async () => {
    if (phase !== 'idle') return;
    if (!validateAll()) return;

    setErrorMessage('');
    setPaymentError('');
    setPhase('submitting');

    let draft = orderDraft;
    if (!draft) {
      draft = buildOrderDraft();
      setOrderDraft(draft);
      idempotencyKeyRef.current = generateUUID();
    }

    if (formData.paymentChoice === 'pay-on-delivery') {
      try {
        const order = await checkoutApi.createOrder(
          {
            checkout: buildCheckoutPayload(draft),
            payment_method: 'COD',
          },
          idempotencyKeyRef.current ?? generateUUID(),
        );
        saveDraft(draft, order.reference);
        finalizeSuccess(order.reference);
      } catch (err) {
        setPhase('idle');
        handleCreateOrderError(err);
      }
      return;
    }

    await fireStkPush(draft);
  };

  const handleCreateOrderError = (err: unknown) => {
    if (err instanceof ApiError) {
      setErrorMessage(
        err.message || 'Could not place your order. Please try again.',
      );
      return;
    }
    setErrorMessage('Could not place your order. Please try again.');
  };

  const fireStkPush = async (draft: OrderDraft) => {
    setPhase('submitting');
    setPaymentError('');

    const phone = formData.mpesaPhone.trim() || formData.contactPhone.trim();
    const amount = Math.round(draft.total);
    const idemKey = idempotencyKeyRef.current ?? generateUUID();
    idempotencyKeyRef.current = idemKey;

    let stk: Payment;
    try {
      stk = await paymentsApi.stkPush(
        {
          ...(draft.orderReference
            ? { order_reference: draft.orderReference }
            : {}),
          amount,
          phone_number: phone,
          metadata: me ? { customer_id: String(me.id) } : undefined,
          checkout: buildCheckoutPayload(draft),
        },
        idemKey,
      );
    } catch (err) {
      setPhase('failed');
      setPaymentError(
        err instanceof ApiError
          ? err.message || 'Could not reach M-Pesa. Please try again.'
          : 'Could not start the M-Pesa request. Please try again.',
      );
      return;
    }

    saveDraft(draft, stk.order_reference);

    setPayment(stk);
    setPhase('awaiting-pin');
    await pollUntilDone(stk.order_reference, stk.id);
  };

  const pollUntilDone = async (orderReference: string, paymentId: string) => {
    const ctrl = new AbortController();
    paymentAbortRef.current = ctrl;

    try {
      const finalPayment = await pollPayment(paymentId, {
        signal: ctrl.signal,
        onPoll: (p) => setPayment(p),
      });

      if (finalPayment.status === 'SUCCESS') {
        finalizeSuccess(orderReference);
        return;
      }

      setPayment(finalPayment);
      setPhase('failed');
      setPaymentError(
        finalPayment.result_description ||
        describeStatus(finalPayment.status) ||
        'Payment could not be completed.',
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setPhase('failed');
      setPaymentError(describeError(err));
    } finally {
      paymentAbortRef.current = null;
    }
  };

  const finalizeSuccess = (orderReference: string) => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }

    if (me) {
      void cartApi.clear().catch(() => {
        /* the order is placed; a stale cart is recoverable */
      });
    } else {
      localClearCart();
    }

    router.push(`/pages/order-success/${orderReference}`);
  };

  const handleRetryPayment = () => {
    idempotencyKeyRef.current = generateUUID();

    if (!orderDraft) return;

    if (payment?.order_reference && !orderDraft.orderReference) {
      const withRef = {
        ...orderDraft,
        orderReference: payment.order_reference,
      };
      setOrderDraft(withRef);
      void fireStkPush(withRef);
      return;
    }

    void fireStkPush(orderDraft);
  };

  const handleChangeMethod = () => {
    paymentAbortRef.current?.abort();
    if (
      payment &&
      (payment.status === 'PROCESSING' || payment.status === 'PENDING')
    ) {
      void paymentsApi.cancel(payment.id).catch(() => {
        /* swallow */
      });
    }
    setOrderDraft(null);
    setPayment(null);
    setPaymentError('');
    setPhase('idle');
    setStep(2);
    idempotencyKeyRef.current = null;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  const taxRatePercent = Math.round(taxConfig.rate * 100);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-3 h-14 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="w-7 h-7 rounded-sm bg-blue-950 text-white font-semibold flex items-center justify-center text-[13px]">
              N
            </span>
            <span className="text-[13px] font-semibold text-slate-900 tracking-tight">
              Secure checkout
            </span>
          </Link>

          <div className="hidden sm:flex items-center gap-1.5 text-[13px] text-emerald-700">
            <Lock className="w-3.5 h-3.5" />
            <span>256-bit SSL encrypted</span>
          </div>

          <Link
            href="/pages/cart"
            className="text-[13px] font-medium text-blue-950 hover:underline"
          >
            Back to cart
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 py-3 space-y-3">
        {me && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-sm p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-[13px] text-emerald-900">
              Signed in as{' '}
              <span className="font-medium">
                {`${me.first_name ?? ''} ${me.last_name ?? ''}`.trim() ||
                  me.email}
              </span>{' '}
              <span className="text-emerald-700">({me.email})</span>
            </p>
            <Link
              href="/pages/account"
              className="text-[13px] font-medium text-emerald-900 hover:underline"
            >
              Manage account
            </Link>
          </div>
        )}

        <StepIndicator current={step} />

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-sm flex items-center gap-2 text-[13px]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form
          onSubmit={handlePlaceOrder}
          className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start"
        >
          <div className="lg:col-span-7 space-y-3">
            {step === 1 && (
              <>
                <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                  <SectionHeader
                    icon={<User className="w-3.5 h-3.5" />}
                    title="Your details"
                    subtitle={
                      me
                        ? 'Prefilled from your account — edit if needed'
                        : 'How we reach you about this order'
                    }
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                    <div className="sm:col-span-2">
                      <Field
                        label="Email address"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        error={fieldErrors.email}
                        icon={<Mail className="w-3.5 h-3.5" />}
                      />
                    </div>
                    <Field
                      label="Full name"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="e.g. Alex Johnson"
                      error={fieldErrors.fullName}
                      icon={<User className="w-3.5 h-3.5" />}
                    />
                    <Field
                      label="Contact phone"
                      name="contactPhone"
                      type="tel"
                      value={formData.contactPhone}
                      onChange={handleChange}
                      placeholder="+254 7XX XXX XXX"
                      error={fieldErrors.contactPhone}
                      icon={<Phone className="w-3.5 h-3.5" />}
                    />
                  </div>
                </section>

                <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                  <SectionHeader
                    icon={<MapPin className="w-3.5 h-3.5" />}
                    title="Delivery address"
                    subtitle="Where should we deliver your order?"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                    <div className="sm:col-span-2">
                      <Field
                        label="Street address"
                        name="street"
                        value={formData.street}
                        onChange={handleChange}
                        placeholder="Building, street, apartment"
                        error={fieldErrors.street}
                      />
                    </div>
                    <Field
                      label="Town / city"
                      name="town"
                      value={formData.town}
                      onChange={handleChange}
                      placeholder="e.g. Nairobi"
                      error={fieldErrors.town}
                    />

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        County
                      </label>
                      <div className="relative">
                        <select
                          name="county"
                          value={formData.county}
                          onChange={handleChange}
                          className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 pr-8 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 appearance-none"
                        >
                          {counties.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>

                    <Field
                      label="Postal code (optional)"
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleChange}
                      placeholder="e.g. 00100"
                    />
                  </div>
                </section>

                <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                  <SectionHeader
                    icon={<Truck className="w-3.5 h-3.5" />}
                    title="Delivery method"
                    subtitle={`Estimated arrival ${estimatedDelivery}`}
                  />

                  <div className="space-y-2">
                    <DeliveryOption
                      id="express"
                      current={formData.deliveryMethod}
                      onSelect={(v) =>
                        setFormData((p) => ({ ...p, deliveryMethod: v }))
                      }
                      icon={<Zap className="w-3.5 h-3.5" />}
                      title="Express courier"
                      sub="24–48 hours with live tracking"
                      price={deliveryFees.express}
                    />
                    <DeliveryOption
                      id="standard"
                      current={formData.deliveryMethod}
                      onSelect={(v) =>
                        setFormData((p) => ({ ...p, deliveryMethod: v }))
                      }
                      icon={<Truck className="w-3.5 h-3.5" />}
                      title="Standard shipping"
                      sub="3–5 business days"
                      price={deliveryFees.standard}
                    />
                    <DeliveryOption
                      id="pickup"
                      current={formData.deliveryMethod}
                      onSelect={(v) =>
                        setFormData((p) => ({ ...p, deliveryMethod: v }))
                      }
                      icon={<Store className="w-3.5 h-3.5" />}
                      title="Store pickup"
                      sub="Ready in 1 hour"
                      price={deliveryFees.pickup}
                    />
                  </div>
                </section>
              </>
            )}

            {step === 2 && phase === 'idle' && (
              <>
                <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                  <SectionHeader
                    icon={<CreditCard className="w-3.5 h-3.5" />}
                    title="How would you like to pay?"
                    subtitle="Pay on delivery or pay now with M-Pesa"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((p) => ({
                          ...p,
                          paymentChoice: 'pay-on-delivery',
                        }))
                      }
                      className={`p-3 border rounded-sm text-left transition flex items-start gap-2.5 ${formData.paymentChoice === 'pay-on-delivery'
                        ? 'border-blue-950 bg-blue-50 ring-1 ring-blue-950'
                        : 'border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${formData.paymentChoice === 'pay-on-delivery'
                          ? 'bg-blue-950 text-white'
                          : 'bg-slate-100 text-slate-500'
                          }`}
                      >
                        <Banknote className="w-4 h-4" />
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block text-[13px] font-medium ${formData.paymentChoice === 'pay-on-delivery'
                            ? 'text-blue-950'
                            : 'text-slate-800'
                            }`}
                        >
                          Pay on delivery
                        </span>
                        <span className="block text-[13px] text-slate-500 mt-0.5">
                          Cash or M-Pesa at the doorstep
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setFormData((p) => ({ ...p, paymentChoice: 'pay-now' }))
                      }
                      className={`p-3 border rounded-sm text-left transition flex items-start gap-2.5 ${formData.paymentChoice === 'pay-now'
                        ? 'border-blue-950 bg-blue-50 ring-1 ring-blue-950'
                        : 'border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${formData.paymentChoice === 'pay-now'
                          ? 'bg-blue-950 text-white'
                          : 'bg-slate-100 text-slate-500'
                          }`}
                      >
                        <Wallet className="w-4 h-4" />
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block text-[13px] font-medium ${formData.paymentChoice === 'pay-now'
                            ? 'text-blue-950'
                            : 'text-slate-800'
                            }`}
                        >
                          Pay now
                        </span>
                        <span className="block text-[13px] text-slate-500 mt-0.5">
                          M-Pesa Express (STK push)
                        </span>
                      </span>
                    </button>
                  </div>

                  {formData.paymentChoice === 'pay-now' && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-sm p-3 space-y-3 text-[13px]">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                        <Smartphone className="w-3.5 h-3.5" />
                        M-Pesa Express (STK push)
                      </div>
                      <Field
                        label="M-Pesa phone number"
                        name="mpesaPhone"
                        value={formData.mpesaPhone}
                        onChange={handleChange}
                        placeholder={
                          formData.contactPhone || '+254 7XX XXX XXX'
                        }
                        error={fieldErrors.mpesaPhone}
                      />
                      <p className="text-[13px] text-slate-600">
                        We&apos;ll send an STK push to this number. Enter your
                        PIN to complete the payment. If you leave this blank,
                        we use the contact number above.
                      </p>
                    </div>
                  )}

                  {formData.paymentChoice === 'pay-on-delivery' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 space-y-2 text-[13px]">
                      <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                        <Banknote className="w-3.5 h-3.5" />
                        Cash or M-Pesa on delivery
                      </div>
                      <p className="text-slate-600">
                        Pay the rider in cash or via M-Pesa when your order is
                        delivered. Please have the exact amount or your phone
                        ready.
                      </p>
                    </div>
                  )}
                </section>

                <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                  <SectionHeader
                    icon={<StickyNote className="w-3.5 h-3.5" />}
                    title="Order notes"
                    subtitle="Optional — delivery instructions or gift message"
                  />
                  <textarea
                    name="orderNotes"
                    value={formData.orderNotes}
                    onChange={handleChange}
                    rows={2}
                    placeholder="e.g. Call on arrival, leave at reception"
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                </section>

                <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="agreeTerms"
                      checked={formData.agreeTerms}
                      onChange={handleChange}
                      className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-blue-950 focus:ring-blue-950"
                    />
                    <span className="text-[13px] text-slate-700">
                      I agree to the{' '}
                      <Link
                        href="/terms"
                        className="text-blue-950 font-medium hover:underline"
                      >
                        Terms of Service
                      </Link>
                      ,{' '}
                      <Link
                        href="/privacy"
                        className="text-blue-950 font-medium hover:underline"
                      >
                        Privacy Policy
                      </Link>{' '}
                      and 30-day return policy.
                    </span>
                  </label>
                  {fieldErrors.agreeTerms && (
                    <p className="text-[13px] text-red-600">
                      {fieldErrors.agreeTerms}
                    </p>
                  )}

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="subscribe"
                      checked={formData.subscribe}
                      onChange={handleChange}
                      className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-blue-950 focus:ring-blue-950"
                    />
                    <span className="text-[13px] text-slate-700">
                      Email me exclusive deals and new arrivals
                    </span>
                  </label>
                </section>
              </>
            )}

            {step === 2 && phase === 'awaiting-pin' && (
              <PinWaitingScreen
                phone={
                  payment?.phone_number ||
                  formData.mpesaPhone ||
                  formData.contactPhone
                }
                amount={totalAmount}
                onCancel={handleChangeMethod}
              />
            )}

            {step === 2 && phase === 'failed' && (
              <PaymentFailedScreen
                message={paymentError}
                onRetry={handleRetryPayment}
                onChangeMethod={handleChangeMethod}
              />
            )}

            {phase === 'idle' && (
              <div className="flex items-center justify-between gap-2">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                ) : (
                  <Link
                    href="/pages/cart"
                    className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Return to cart
                  </Link>
                )}

                {step < 2 && (
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-[13px] transition"
                  >
                    Continue
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {phase === 'idle' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <TrustBadge
                  icon={<Lock className="w-3.5 h-3.5" />}
                  title="Secure payment"
                  sub="SSL encrypted"
                />
                <TrustBadge
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  title="30-day returns"
                  sub="No questions asked"
                />
                <TrustBadge
                  icon={<ShieldCheck className="w-3.5 h-3.5" />}
                  title="Genuine products"
                  sub="Warranty included"
                />
              </div>
            )}
          </div>

          <aside className="lg:col-span-5 space-y-3 lg:sticky lg:top-16">
            <div className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h2 className="text-[15px] font-semibold text-slate-900">
                  Order summary
                </h2>
                {phase === 'idle' && (
                  <Link
                    href="/pages/cart"
                    className="text-[13px] font-medium text-blue-950 hover:underline"
                  >
                    Edit cart
                  </Link>
                )}
              </div>

              <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto -mx-2">
                {checkoutItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 px-2 py-2"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-11 h-11 rounded-sm object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-slate-900 truncate">
                        {item.name}
                      </p>
                      <p className="text-[13px] text-slate-500">
                        Qty {item.quantity} × {formatKES(item.price)}
                      </p>
                    </div>
                    <span className="text-[13px] font-medium text-slate-900 shrink-0">
                      {formatKES(item.price * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              {phase === 'idle' && (
                <div className="pt-2 border-t border-slate-100">
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-sm px-2 py-1.5">
                      <span className="text-[13px] font-medium text-emerald-700 inline-flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        {appliedCoupon} — {Math.round(appliedDiscountPct * 100)}% off
                      </span>
                      <button
                        type="button"
                        onClick={removeCoupon}
                        className="text-emerald-700 hover:text-emerald-900 p-1"
                        aria-label="Remove coupon"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleApplyCoupon();
                            }
                          }}
                          placeholder="Coupon code"
                          className="w-full bg-white border border-slate-200 rounded-sm pl-8 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={couponChecking}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
                      >
                        {couponChecking ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          'Apply'
                        )}
                      </button>
                    </div>
                  )}
                  {couponMessage && (
                    <p
                      className={`text-[13px] mt-1.5 ${couponValid ? 'text-emerald-600' : 'text-red-600'
                        }`}
                    >
                      {couponMessage}
                    </p>
                  )}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 space-y-2 text-[13px] text-slate-600">
                <Row label="Subtotal" value={formatKES(subtotal)} />
                {discountAmount > 0 && (
                  <Row
                    label={`Discount${appliedCoupon ? ` (${appliedCoupon})` : ''
                      }`}
                    value={`- ${formatKES(discountAmount)}`}
                    success
                  />
                )}
                <Row
                  label={`Shipping (${formData.deliveryMethod})`}
                  value={shippingFee === 0 ? 'Free' : formatKES(shippingFee)}
                />
                {taxConfig.enabled && (
                  <Row
                    label={
                      taxConfig.pricesIncludeTax
                        ? `VAT (${taxRatePercent}% included)`
                        : `VAT (${taxRatePercent}%)`
                    }
                    value={formatKES(taxAmount)}
                  />
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[15px] font-semibold text-slate-900">
                  Total
                </span>
                <span className="text-[15px] font-bold text-slate-900">
                  {formatKES(totalAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between text-[13px] text-slate-600 pt-1">
                <span>Payment</span>
                <span className="font-medium text-slate-900">
                  {paymentLabel}
                </span>
              </div>

              {step === 2 && phase === 'idle' && (
                <button
                  type="submit"
                  disabled={!authResolved}
                  className="w-full bg-blue-950 hover:bg-blue-900 text-white font-medium py-2.5 px-4 rounded-sm text-[13px] transition flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {formData.paymentChoice === 'pay-on-delivery'
                    ? `Place order — ${formatKES(totalAmount)}`
                    : `Pay ${formatKES(totalAmount)}`}
                </button>
              )}

              {step === 2 && phase === 'submitting' && (
                <button
                  type="button"
                  disabled
                  className="w-full bg-blue-950 text-white font-medium py-2.5 px-4 rounded-sm text-[13px] transition flex items-center justify-center gap-1.5 opacity-70 cursor-not-allowed"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {formData.paymentChoice === 'pay-now'
                    ? 'Sending M-Pesa request…'
                    : 'Placing order…'}
                </button>
              )}

              {step < 2 && phase === 'idle' && (
                <button
                  type="button"
                  onClick={goNext}
                  className="w-full bg-blue-950 hover:bg-blue-900 text-white font-medium py-2.5 px-4 rounded-sm text-[13px] transition flex items-center justify-center gap-1.5"
                >
                  Continue to payment
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              <p className="text-[13px] text-slate-500 text-center leading-relaxed">
                By placing your order you authorize us to charge your selected
                payment method.
              </p>
            </div>
          </aside>
        </form>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function PinWaitingScreen({
  phone,
  amount,
  onCancel,
}: {
  phone: string;
  amount: number;
  onCancel: () => void;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-sm p-6 space-y-4 text-center">
      <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
        <Smartphone className="w-6 h-6" />
      </div>

      <div className="space-y-1">
        <h2 className="text-[15px] font-semibold text-slate-900">
          Check your phone
        </h2>
        <p className="text-[13px] text-slate-500">
          We sent an M-Pesa request to{' '}
          <span className="font-mono text-slate-700">{phone}</span>
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 text-left text-[13px] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Amount</span>
          <span className="font-semibold text-slate-900">
            {formatKES(amount)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Reference</span>
          <span className="font-mono text-slate-700">Order payment</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-[13px] text-slate-600">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
        <span>Waiting for you to enter your M-Pesa PIN…</span>
      </div>

      <p className="text-[12px] text-slate-400">
        This usually takes 15–30 seconds. Don&apos;t close this page.
      </p>

      <button
        type="button"
        onClick={onCancel}
        className="text-[13px] font-medium text-slate-500 hover:text-slate-800 underline underline-offset-2"
      >
        Cancel payment
      </button>
    </section>
  );
}

function PaymentFailedScreen({
  message,
  onRetry,
  onChangeMethod,
}: {
  message: string;
  onRetry: () => void;
  onChangeMethod: () => void;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-sm p-6 space-y-4 text-center">
      <div className="w-14 h-14 mx-auto rounded-full bg-red-50 text-red-600 flex items-center justify-center">
        <AlertCircle className="w-6 h-6" />
      </div>

      <div className="space-y-1">
        <h2 className="text-[15px] font-semibold text-slate-900">
          Payment failed
        </h2>
        <p className="text-[13px] text-slate-600 max-w-md mx-auto">
          {message || 'The M-Pesa request could not be completed.'}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2.5 rounded-sm text-[13px] transition w-full sm:w-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
        <button
          type="button"
          onClick={onChangeMethod}
          className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2.5 rounded-sm text-[13px] transition w-full sm:w-auto"
        >
          Change payment method
        </button>
      </div>

      <p className="text-[12px] text-slate-400">
        If money was deducted, it will be refunded automatically within 24
        hours.
      </p>
    </section>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1 as Step, label: 'Details' },
    { n: 2 as Step, label: 'Payment' },
  ];
  return (
    <ol className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between gap-2">
      {steps.map((s, idx) => {
        const isComplete = current > s.n;
        const isActive = current === s.n;
        return (
          <li key={s.n} className="flex items-center gap-2 flex-1">
            <span
              className={`w-6 h-6 rounded-sm flex items-center justify-center text-[13px] font-medium shrink-0 ${isComplete
                ? 'bg-emerald-500 text-white'
                : isActive
                  ? 'bg-blue-950 text-white'
                  : 'bg-slate-100 text-slate-500'
                }`}
            >
              {isComplete ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.n}
            </span>
            <span
              className={`text-[13px] font-medium truncate ${isActive
                ? 'text-blue-950'
                : isComplete
                  ? 'text-emerald-700'
                  : 'text-slate-500'
                }`}
            >
              {s.label}
            </span>
            {idx < steps.length - 1 && (
              <span
                className={`flex-1 h-px ${isComplete ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="flex items-start gap-2 pb-2 border-b border-slate-100">
      <span className="w-7 h-7 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-slate-900 truncate">
          {title}
        </p>
        {subtitle && (
          <p className="text-[13px] text-slate-500 truncate">{subtitle}</p>
        )}
      </div>
    </header>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  icon,
  mono,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="block font-medium text-slate-700 mb-1">{label}</span>
      <div className="relative">
        {icon && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        )}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full bg-white border rounded-sm py-2 text-[13px] focus:outline-none focus:ring-1 ${icon ? 'pl-8 pr-3' : 'px-3'
            } ${error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-slate-200 focus:border-blue-950 focus:ring-blue-950'
            } ${mono ? 'font-mono' : ''}`}
        />
      </div>
      {error && <p className="text-[13px] text-red-600 mt-1">{error}</p>}
    </label>
  );
}

function DeliveryOption({
  id,
  current,
  onSelect,
  icon,
  title,
  sub,
  price,
}: {
  id: DeliveryMethod;
  current: DeliveryMethod;
  onSelect: (v: DeliveryMethod) => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
  price: number;
}) {
  const active = current === id;
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`w-full flex items-center justify-between gap-2 p-2 border rounded-sm text-left transition ${active
        ? 'border-blue-950 bg-blue-50 ring-1 ring-blue-950'
        : 'border-slate-200 hover:bg-slate-50'
        }`}
    >
      <span className="flex items-start gap-2 min-w-0">
        <span
          className={`w-7 h-7 rounded-sm flex items-center justify-center shrink-0 ${active ? 'bg-blue-950 text-white' : 'bg-slate-100 text-slate-500'
            }`}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span
            className={`block text-[13px] font-medium ${active ? 'text-blue-950' : 'text-slate-800'
              }`}
          >
            {title}
          </span>
          <span className="block text-[13px] text-slate-500 mt-0.5">{sub}</span>
        </span>
      </span>
      <span className="text-[13px] font-medium text-slate-900 shrink-0">
        {price === 0 ? 'Free' : formatKES(price)}
      </span>
    </button>
  );
}

function TrustBadge({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center gap-2">
      <span className="w-7 h-7 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-900 truncate">
          {title}
        </p>
        <p className="text-[13px] text-slate-500 truncate">{sub}</p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  success,
  emphasis,
}: {
  label: string;
  value: string;
  mono?: boolean;
  success?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={emphasis ? 'text-slate-900 font-medium' : 'text-slate-500'}
      >
        {label}
      </span>
      <span
        className={`${emphasis ? 'text-slate-900 font-semibold' : ''} ${success ? 'text-emerald-600 font-medium' : ''
          } ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}