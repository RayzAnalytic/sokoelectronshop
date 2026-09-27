'use client';

import React, { useState } from 'react';
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
  CreditCard,
  Smartphone,
  RotateCcw,
  CheckSquare,
  Square,
  AlertTriangle,
  StickyNote,
} from 'lucide-react';
import Header from '@/components/homepage/Navbar';
import Footer from '@/components/homepage/Footer';
import { useCart, type CartItem } from '@/lib/store/cart';

type DeliveryMethod = 'standard' | 'express' | 'pickup';

const FREE_SHIPPING_THRESHOLD = 1200;

export default function CartPage() {
  const router = useRouter();

  const items = useCart((s) => s.items);
  const updateQty = useCart((s) => s.updateQty);
  const removeItem = useCart((s) => s.removeItem);
  const clearCart = useCart((s) => s.clear);

  // Selection is UI-only, so it lives locally. Items not in this set are selected.
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set());

  const [couponCode, setCouponCode] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<string>('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [couponMessage, setCouponMessage] = useState<string>('');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('standard');
  const [orderNotes, setOrderNotes] = useState<string>('');

  const isSelected = (id: string) => !deselectedIds.has(id);
  const selectedItems = items.filter((i) => isSelected(i.id));
  const allSelected = items.length > 0 && selectedItems.length === items.length;

  const handleUpdateQuantity = (item: CartItem, newQty: number): void => {
    if (newQty < 1) return;
    if (item.stockCount && newQty > item.stockCount) {
      alert(`Cannot add more. Maximum available stock for this item is ${item.stockCount}.`);
      return;
    }
    updateQty(item.id, newQty);
  };

  const handleRemoveItem = (id: string): void => {
    removeItem(id);
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
    selectedItems.forEach((i) => removeItem(i.id));
    setDeselectedIds(new Set());
  };

  const handleClearCart = (): void => {
    if (confirm('Remove all items from your cart?')) {
      clearCart();
      setDeselectedIds(new Set());
      setAppliedCoupon('');
      setAppliedDiscount(0);
      setCouponMessage('');
    }
  };

  const handleApplyCoupon = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (code === 'SPRING10') {
      setAppliedDiscount(0.1);
      setAppliedCoupon(code);
      setCouponMessage('10% discount applied to your order.');
    } else if (code === 'WELCOME20') {
      setAppliedDiscount(0.2);
      setAppliedCoupon(code);
      setCouponMessage('20% discount applied to your order.');
    } else {
      setAppliedCoupon('');
      setAppliedDiscount(0);
      setCouponMessage('Invalid coupon code. Try "SPRING10" or "WELCOME20".');
    }
  };

  const handleRemoveCoupon = (): void => {
    setAppliedCoupon('');
    setAppliedDiscount(0);
    setCouponCode('');
    setCouponMessage('');
  };

  // Calculations — only over SELECTED items
  const subtotal = selectedItems.reduce<number>(
    (acc, item) => acc + item.unitPrice * item.quantity,
    0
  );

  const discountAmount = subtotal * appliedDiscount;
  const shippingFee =
    deliveryMethod === 'pickup'
      ? 0
      : deliveryMethod === 'express'
      ? 24.99
      : subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0
      ? 0
      : 9.99;
  const taxAmount = (subtotal - discountAmount) * 0.085;
  const total = subtotal - discountAmount + shippingFee + taxAmount;

  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const freeShippingProgress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  const estimatedDelivery = (() => {
    const today = new Date();
    const days = deliveryMethod === 'express' ? 1 : deliveryMethod === 'pickup' ? 0 : 3;
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

    // Pass selected item ids + delivery/coupon state to checkout via query string
    const params = new URLSearchParams();
    params.set('items', selectedItems.map((i) => i.id).join(','));
    params.set('delivery', deliveryMethod);
    if (appliedCoupon) params.set('coupon', appliedCoupon);
    if (orderNotes.trim()) params.set('notes', orderNotes.trim());

    router.push(`/pages/checkout?${params.toString()}`);
  };

  const handleWhatsAppOrder = () => {
    if (selectedItems.length === 0) {
      alert('Please select at least one item to send via WhatsApp.');
      return;
    }
    const itemsText = selectedItems
      .map(
        (item) =>
          `• ${item.name} (x${item.quantity}) - $${(item.unitPrice * item.quantity).toFixed(2)}`
      )
      .filter(Boolean)
      .join('%0A');

    const message = `Hello! I would like to place an order:%0A%0A${itemsText}%0A%0ASubtotal: $${subtotal.toFixed(
      2
    )}%0ADiscount: -$${discountAmount.toFixed(2)}%0AShipping (${deliveryMethod}): ${
      shippingFee === 0 ? 'FREE' : `$${shippingFee.toFixed(2)}`
    }%0ATax: $${taxAmount.toFixed(2)}%0A%0A*Total: $${total.toFixed(2)}*${
      orderNotes ? `%0A%0ANotes: ${encodeURIComponent(orderNotes)}` : ''
    }`;

    const phoneNumber = '254712345678';
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
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
                className="text-[13px] font-medium text-red-600 hover:underline inline-flex items-center gap-1"
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

        {items.length > 0 ? (
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
                          ${remainingForFreeShipping.toFixed(2)}
                        </span>{' '}
                        more for free shipping
                      </>
                    ) : (
                      <span className="text-emerald-700 font-medium">
                        You've unlocked free shipping
                      </span>
                    )}
                  </p>
                  <Truck className="w-3.5 h-3.5 text-blue-950 shrink-0" />
                </div>
                <div className="h-1.5 rounded-sm bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      freeShippingProgress >= 100 ? 'bg-emerald-500' : 'bg-blue-950'
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
                  const isLowStock = item.stockCount !== undefined && item.stockCount <= 3;
                  return (
                    <div
                      key={item.id}
                      className="p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
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
                          href={`/pages/products/${item.slug}`}
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
                          <Link href={`/pages/products/${item.slug}`}>
                            <h3 className="text-[13px] font-semibold text-slate-900 hover:text-blue-950 transition truncate">
                              {item.name}
                            </h3>
                          </Link>
                          {item.stock && (
                            <p
                              className={`text-[13px] font-medium inline-flex items-center gap-1 ${
                                isLowStock ? 'text-amber-600' : 'text-emerald-600'
                              }`}
                            >
                              {isLowStock && <AlertTriangle className="w-3 h-3" />}
                              {item.stock}
                              {item.stockCount !== undefined && ` • Max ${item.stockCount}`}
                            </p>
                          )}
                          <div className="flex items-baseline gap-2 pt-0.5">
                            <span className="text-[13px] font-bold text-slate-900">
                              ${item.unitPrice.toFixed(2)}
                            </span>
                            {item.compareAtPrice && (
                              <span className="text-[13px] text-slate-400 line-through">
                                ${item.compareAtPrice.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 gap-3">
                        {/* Save for later */}
                        <button
                          onClick={() => {
                            handleRemoveItem(item.id);
                            alert(`"${item.name}" saved to your wishlist.`);
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-sm hover:bg-rose-50 transition"
                          title="Save for later"
                        >
                          <Heart className="w-4 h-4" />
                        </button>

                        <div className="flex items-center border border-slate-200 rounded-sm overflow-hidden bg-white">
                          <button
                            onClick={() => handleUpdateQuantity(item, item.quantity - 1)}
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 transition"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-[13px] font-semibold text-slate-900">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleUpdateQuantity(item, item.quantity + 1)}
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 transition"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="text-right min-w-[65px]">
                          <span className="text-[13px] font-bold text-slate-900">
                            ${(item.unitPrice * item.quantity).toFixed(2)}
                          </span>
                        </div>

                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-slate-400 hover:text-red-600 p-1.5 rounded-sm hover:bg-red-50 transition"
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
                      {appliedCoupon} applied — {appliedDiscount * 100}% off
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
                      placeholder="Enter coupon (e.g. SPRING10)"
                      className="flex-1 bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                    />
                    <button
                      type="submit"
                      className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
                    >
                      Apply
                    </button>
                  </form>
                )}

                {couponMessage && (
                  <p
                    className={`text-[13px] font-medium ${
                      appliedDiscount > 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {couponMessage}
                  </p>
                )}

                <p className="text-[13px] text-slate-400">
                  Try <span className="font-mono">SPRING10</span> or{' '}
                  <span className="font-mono">WELCOME20</span>
                </p>
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
                      { id: 'standard', label: 'Standard', sub: '2–3 days', price: 9.99, icon: Truck },
                      { id: 'express', label: 'Express', sub: 'Next day', price: 24.99, icon: Zap },
                      { id: 'pickup', label: 'Store pickup', sub: 'Ready in 1h', price: 0, icon: Store },
                    ] as const
                  ).map(({ id, label, sub, price, icon: Icon }) => {
                    const active = deliveryMethod === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setDeliveryMethod(id)}
                        className={`p-2 rounded-sm border text-left transition flex items-start gap-2 ${
                          active
                            ? 'border-blue-950 bg-blue-50'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            active ? 'text-blue-950' : 'text-slate-400'
                          }`}
                        />
                        <div className="min-w-0">
                          <p
                            className={`text-[13px] font-medium ${
                              active ? 'text-blue-950' : 'text-slate-800'
                            }`}
                          >
                            {label}
                          </p>
                          <p className="text-[13px] text-slate-500 mt-0.5">{sub}</p>
                          <p className="text-[13px] font-medium text-slate-900 mt-0.5">
                            {price === 0 ? 'Free' : `$${price.toFixed(2)}`}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[13px] text-slate-500 pt-1">
                  Estimated arrival:{' '}
                  <span className="font-medium text-slate-900">{estimatedDelivery}</span>
                </p>
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
                      ${subtotal.toFixed(2)}
                    </span>
                  </div>
                  {appliedDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Discount ({appliedDiscount * 100}%)</span>
                      <span>-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span className="font-medium text-slate-900">
                      {shippingFee === 0 ? 'Free' : `$${shippingFee.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT (8.5%)</span>
                    <span className="font-medium text-slate-900">
                      ${taxAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-slate-900">
                    Total
                  </span>
                  <span className="text-[15px] font-bold text-slate-900">
                    ${total.toFixed(2)}
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
                  <PaymentChip icon={<Smartphone className="w-3.5 h-3.5" />} label="M-Pesa" />
                  <PaymentChip icon={<Smartphone className="w-3.5 h-3.5" />} label="Airtel" />
                  <PaymentChip icon={<CreditCard className="w-3.5 h-3.5" />} label="Card" />
                  <PaymentChip icon={<Store className="w-3.5 h-3.5" />} label="COD" />
                </div>

                {/* WhatsApp */}
                <button
                  type="button"
                  onClick={handleWhatsAppOrder}
                  disabled={selectedItems.length === 0}
                  className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium py-2 px-4 rounded-sm text-[13px] transition flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  <span>Continue with WhatsApp</span>
                </button>

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
function PaymentChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[13px] text-slate-600 bg-white border border-slate-200 rounded-sm px-2 py-1">
      {icon}
      {label}
    </span>
  );
}