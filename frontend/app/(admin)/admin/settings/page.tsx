'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Save,
  Building,
  Receipt,
  Globe,
  Plug,
  Send,
  X,
  AlertTriangle,
  Store,
  CreditCard,
  Truck,
  Bell,
  ShieldCheck,
  Key,
  Smartphone,
  Plus,
  Trash2,
  Lock,
  MapPin,
  Users,
  UserX,
  LogIn,
  Clock,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================
type SettingsTab =
  | 'general'
  | 'store'
  | 'payments'
  | 'shipping'
  | 'notifications'
  | 'security'
  | 'integrations'
  | 'tax';

interface IntegrationStatus {
  id: string;
  name: string;
  category: string;
  connected: boolean;
  description: string;
}

interface DeliveryZone {
  id: string;
  name: string;
  region: string;
  fee: string;
  eta: string;
  enabled: boolean;
}

interface LoginEntry {
  id: string;
  device: string;
  ip: string;
  location: string;
  time: string;
  current: boolean;
}

interface ActiveSession {
  id: string;
  device: string;
  ip: string;
  started: string;
  current: boolean;
}

// ============================================================
// TABS
// ============================================================
const TABS: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'general', label: 'General', icon: Building },
  { id: 'store', label: 'Store', icon: Store },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'shipping', label: 'Shipping', icon: Truck },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'tax', label: 'Tax', icon: Receipt },
];

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================
export default function StoreSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const [pendingTab, setPendingTab] = useState<SettingsTab | null>(null);

  // ── GENERAL ──
  const [storeName, setStoreName] = useState('SokoFlow Commerce');
  const [tagline, setTagline] = useState('Conversational commerce for WhatsApp & M-Pesa');
  const [contactEmail, setContactEmail] = useState('admin@sokoflow.co.ke');
  const [phone, setPhone] = useState('+254 712 345 678');
  const [address, setAddress] = useState('Westlands Commercial Centre, Nairobi, Kenya');
  const [currency, setCurrency] = useState('KES');
  const [timezone, setTimezone] = useState('Africa/Nairobi');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [weightUnit, setWeightUnit] = useState('kg');

  // ── STORE ──
  const [storeStatus, setStoreStatus] = useState<'open' | 'closed' | 'paused'>('open');
  const [storeVisible, setStoreVisible] = useState(true);
  const [checkoutGuest, setCheckoutGuest] = useState(true);
  const [checkoutRequirePhone, setCheckoutRequirePhone] = useState(true);
  const [checkoutAutoConfirm, setCheckoutAutoConfirm] = useState(false);
  const [checkoutWhatsAppFallback, setCheckoutWhatsAppFallback] = useState(true);
  const [inventoryTrack, setInventoryTrack] = useState(true);
  const [inventoryLowThreshold, setInventoryLowThreshold] = useState('5');
  const [inventoryAllowBackorder, setInventoryAllowBackorder] = useState(false);
  const [inventoryHideOutOfStock, setInventoryHideOutOfStock] = useState(false);
  const [reviewsEnabled, setReviewsEnabled] = useState(true);
  const [reviewsRequirePurchase, setReviewsRequirePurchase] = useState(true);
  const [reviewsAutoPublish, setReviewsAutoPublish] = useState(false);
  const [reviewsAllowPhotos, setReviewsAllowPhotos] = useState(true);

  // ── PAYMENTS (preferences only; credentials managed by developer) ──
  const [mpesaEnabled, setMpesaEnabled] = useState(true);
  const [airtelEnabled, setAirtelEnabled] = useState(false);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [codEnabled, setCodEnabled] = useState(true);
  const [codFee, setCodFee] = useState('0');
  const [txnMinAmount, setTxnMinAmount] = useState('100');
  const [txnMaxAmount, setTxnMaxAmount] = useState('500000');
  const [txnFee, setTxnFee] = useState('0');
  const [txnAutoRefund, setTxnAutoRefund] = useState(true);
  const [txnAutoCapture, setTxnAutoCapture] = useState(true);
  const [paymentMethodsOrder, setPaymentMethodsOrder] = useState<string[]>([
    'M-Pesa',
    'Cash on Delivery',
    'Airtel Money',
    'Stripe',
  ]);

  // ── SHIPPING ──
  const [shippingEnabled, setShippingEnabled] = useState(true);
  const [shippingFreeThreshold, setShippingFreeThreshold] = useState('5000');
  const [shippingDefaultFee, setShippingDefaultFee] = useState('250');
  const [shippingLocalPickup, setShippingLocalPickup] = useState(true);
  const [shippingProviders, setShippingProviders] = useState({
    g4s: true,
    fargo: true,
    sendy: false,
    riders: true,
  });
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([
    { id: 'z1', name: 'Nairobi CBD', region: 'Nairobi', fee: '250', eta: 'Same day', enabled: true },
    { id: 'z2', name: 'Westlands & Parklands', region: 'Nairobi', fee: '300', eta: 'Same day', enabled: true },
    { id: 'z3', name: 'Kilimani & Kileleshwa', region: 'Nairobi', fee: '300', eta: 'Same day', enabled: true },
    { id: 'z4', name: 'Mombasa', region: 'Coast', fee: '600', eta: '1–2 days', enabled: true },
    { id: 'z5', name: 'Kisumu', region: 'Nyanza', fee: '600', eta: '1–2 days', enabled: true },
    { id: 'z6', name: 'Countrywide (other)', region: 'Kenya', fee: '750', eta: '2–3 days', enabled: true },
  ]);
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [zoneRegion, setZoneRegion] = useState('');
  const [zoneFee, setZoneFee] = useState('');
  const [zoneEta, setZoneEta] = useState('');

  // ── NOTIFICATIONS ──
  const [notifEmailEnabled, setNotifEmailEnabled] = useState(true);
  const [notifSmsEnabled, setNotifSmsEnabled] = useState(true);
  const [notifWhatsAppEnabled, setNotifWhatsAppEnabled] = useState(true);
  const [notifOnNewOrder, setNotifOnNewOrder] = useState(true);
  const [notifOnPayment, setNotifOnPayment] = useState(true);
  const [notifOnShipped, setNotifOnShipped] = useState(true);
  const [notifOnCancelled, setNotifOnCancelled] = useState(true);
  const [notifOnLowStock, setNotifOnLowStock] = useState(true);
  const [notifOnReview, setNotifOnReview] = useState(false);
  const [notifAdminEmail, setNotifAdminEmail] = useState('alerts@sokoflow.co.ke');

  // ── SECURITY (shop owner's personal account) ──
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFaEnabled, setTwoFaEnabled] = useState(true);
  const [twoFaMethod, setTwoFaMethod] = useState<'authenticator' | 'sms'>('authenticator');
  const [sessionTimeout, setSessionTimeout] = useState('60');
  const [sessions, setSessions] = useState<ActiveSession[]>([
    { id: 's1', device: 'Chrome · macOS', ip: '197.232.14.20', started: '2 hours ago', current: true },
    { id: 's2', device: 'Safari · iPhone 14', ip: '105.162.8.44', started: 'Yesterday', current: false },
    { id: 's3', device: 'Firefox · Windows 11', ip: '41.90.64.10', started: '3 days ago', current: false },
  ]);
  const [loginHistory] = useState<LoginEntry[]>([
    { id: 'l1', device: 'Chrome · macOS', ip: '197.232.14.20', location: 'Nairobi, KE', time: 'Today, 09:14', current: true },
    { id: 'l2', device: 'Safari · iPhone', ip: '105.162.8.44', location: 'Nairobi, KE', time: 'Yesterday, 18:22', current: false },
    { id: 'l3', device: 'Firefox · Windows', ip: '41.90.64.10', location: 'Mombasa, KE', time: '2 days ago', current: false },
    { id: 'l4', device: 'Chrome · Android', ip: '197.232.14.88', location: 'Nairobi, KE', time: '5 days ago', current: false },
  ]);

  // ── INTEGRATIONS (status only; configuration handled by developer) ──
  const [integrations] = useState<IntegrationStatus[]>([
    { id: 'whatsapp', name: 'WhatsApp Cloud API', category: 'Messaging', connected: true, description: 'Official Meta WhatsApp Business API for order notifications and cart reminders.' },
    { id: 'mpesa', name: 'Safaricom M-Pesa Daraja', category: 'Payments', connected: true, description: 'STK Push and C2B Paybill automated instant settlement.' },
    { id: 'airtel', name: 'Airtel Money API', category: 'Payments', connected: false, description: 'Airtel Money mobile wallet checkout integration.' },
    { id: 'stripe', name: 'Stripe International', category: 'Payments', connected: false, description: 'Global Visa, Mastercard, and Apple Pay processing.' },
    { id: 'ga', name: 'Google Analytics 4', category: 'Analytics', connected: true, description: 'Advanced visitor behavioral tracking and conversion funnels.' },
    { id: 'meta', name: 'Meta Pixel', category: 'Analytics', connected: true, description: 'Facebook & Instagram ad conversion attribution.' },
    { id: 'tiktok', name: 'TikTok Pixel', category: 'Analytics', connected: false, description: 'TikTok ad campaign conversion tracking.' },
    { id: 'facebook', name: 'Facebook Shop Sync', category: 'Social', connected: false, description: 'Sync catalog and inventory with Facebook & Instagram Shops.' },
    { id: 'instagram', name: 'Instagram Shop', category: 'Social', connected: false, description: 'Enable product tagging and checkout on Instagram.' },
  ]);

  // ── TAX (preferences only) ──
  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRate, setVatRate] = useState('16');
  const [pricesIncludeTax, setPricesIncludeTax] = useState(true);
  const [etimsEnabled, setEtimsEnabled] = useState(true);

  // ── EFFECTS ──
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (!showUnsavedPrompt && !isZoneModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isZoneModalOpen) setIsZoneModalOpen(false);
        else {
          setShowUnsavedPrompt(false);
          setPendingTab(null);
        }
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [showUnsavedPrompt, isZoneModalOpen]);

  const toast = (msg: string) => setToastMessage(msg);

  const change = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    setter(value);
    setHasUnsavedChanges(true);
  };

  const handleTabClick = (tab: SettingsTab) => {
    if (hasUnsavedChanges) {
      setPendingTab(tab);
      setShowUnsavedPrompt(true);
    } else {
      setActiveTab(tab);
    }
  };

  const confirmTabSwitch = () => {
    if (pendingTab) {
      setActiveTab(pendingTab);
      setHasUnsavedChanges(false);
    }
    setShowUnsavedPrompt(false);
    setPendingTab(null);
  };

  const saveAll = () => {
    setHasUnsavedChanges(false);
    toast('Settings saved');
  };

  const openZoneModal = (z?: DeliveryZone) => {
    if (z) {
      setEditingZone(z);
      setZoneName(z.name);
      setZoneRegion(z.region);
      setZoneFee(z.fee);
      setZoneEta(z.eta);
    } else {
      setEditingZone(null);
      setZoneName('');
      setZoneRegion('');
      setZoneFee('');
      setZoneEta('');
    }
    setIsZoneModalOpen(true);
  };

  const saveZone = () => {
    if (!zoneName.trim()) {
      toast('Zone name required');
      return;
    }
    if (editingZone) {
      setDeliveryZones((prev) =>
        prev.map((z) =>
          z.id === editingZone.id
            ? { ...z, name: zoneName, region: zoneRegion, fee: zoneFee, eta: zoneEta }
            : z
        )
      );
      toast('Zone updated');
    } else {
      setDeliveryZones((prev) => [
        ...prev,
        {
          id: `z-${Date.now()}`,
          name: zoneName,
          region: zoneRegion,
          fee: zoneFee,
          eta: zoneEta,
          enabled: true,
        },
      ]);
      toast('Zone added');
    }
    setHasUnsavedChanges(true);
    setIsZoneModalOpen(false);
  };

  const deleteZone = (id: string) => {
    setDeliveryZones((prev) => prev.filter((z) => z.id !== id));
    setHasUnsavedChanges(true);
    toast('Zone removed');
  };

  const toggleZone = (id: string) => {
    setDeliveryZones((prev) => prev.map((z) => (z.id === id ? { ...z, enabled: !z.enabled } : z)));
    setHasUnsavedChanges(true);
  };

  const revokeSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    toast('Session revoked');
  };

  const movePaymentMethod = (from: number, to: number) => {
    if (to < 0 || to >= paymentMethodsOrder.length) return;
    setPaymentMethodsOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setHasUnsavedChanges(true);
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
            <h1 className="text-[15px] font-semibold text-slate-900">Store settings</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Identity, storefront behavior, payments, shipping, notifications, and security
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <span className="hidden sm:inline-block text-[13px] font-medium text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-sm">
                Unsaved changes
              </span>
            )}
            <button
              onClick={saveAll}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save changes</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

          {/* SIDEBAR */}
          <aside className="lg:col-span-3">
            <nav className="bg-white border border-slate-200 rounded-sm p-1.5 space-y-0.5 lg:sticky lg:top-20">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-sm text-[13px] font-medium transition ${
                      isActive ? 'bg-blue-950 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* CONTENT */}
          <div className="lg:col-span-9 space-y-3">

            {/* ══════════════ GENERAL ══════════════ */}
            {activeTab === 'general' && (
              <Card title="General information" subtitle="Business name, contact details, and regional formatting">
                <SubSection title="Business identity">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                    <Field label="Business name" value={storeName} onChange={(v) => change(setStoreName, v)} />
                    <Field label="Tagline" value={tagline} onChange={(v) => change(setTagline, v)} />
                  </div>
                </SubSection>

                <SubSection title="Contact">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                    <Field label="Email" value={contactEmail} onChange={(v) => change(setContactEmail, v)} type="email" />
                    <Field label="Phone" value={phone} onChange={(v) => change(setPhone, v)} />
                    <div className="sm:col-span-2">
                      <Field label="Address" value={address} onChange={(v) => change(setAddress, v)} />
                    </div>
                  </div>
                </SubSection>

                <SubSection title="Regional">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                    <SelectField
                      label="Currency"
                      value={currency}
                      onChange={(v) => change(setCurrency, v)}
                      options={[
                        { v: 'KES', l: 'KES (Kenyan Shilling)' },
                        { v: 'USD', l: 'USD ($ US Dollar)' },
                        { v: 'EUR', l: 'EUR (€ Euro)' },
                      ]}
                    />
                    <SelectField
                      label="Timezone"
                      value={timezone}
                      onChange={(v) => change(setTimezone, v)}
                      options={[
                        { v: 'Africa/Nairobi', l: 'Africa/Nairobi (GMT+3)' },
                        { v: 'UTC', l: 'UTC (GMT+0)' },
                      ]}
                    />
                    <SelectField
                      label="Date format"
                      value={dateFormat}
                      onChange={(v) => change(setDateFormat, v)}
                      options={[
                        { v: 'DD/MM/YYYY', l: 'DD/MM/YYYY' },
                        { v: 'MM/DD/YYYY', l: 'MM/DD/YYYY' },
                        { v: 'YYYY-MM-DD', l: 'YYYY-MM-DD' },
                      ]}
                    />
                    <SelectField
                      label="Weight unit"
                      value={weightUnit}
                      onChange={(v) => change(setWeightUnit, v)}
                      options={[
                        { v: 'kg', l: 'Kilogram (kg)' },
                        { v: 'g', l: 'Gram (g)' },
                        { v: 'lb', l: 'Pound (lb)' },
                      ]}
                    />
                  </div>
                </SubSection>
              </Card>
            )}

            {/* ══════════════ STORE ══════════════ */}
            {activeTab === 'store' && (
              <>
                <Card title="Store status" subtitle="Control public visibility and availability">
                  <SubSection title="Status">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[13px]">
                      {(['open', 'closed', 'paused'] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => change(setStoreStatus, st)}
                          className={`p-2 rounded-sm border text-left capitalize transition ${
                            storeStatus === st ? 'border-blue-950 bg-blue-50/40 text-blue-950' : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-[13px] font-medium">{st}</span>
                        </button>
                      ))}
                    </div>
                    <ToggleRow
                      label="Store visible on search engines"
                      description="Allow Google and other search engines to index your store"
                      checked={storeVisible}
                      onChange={(v) => change(setStoreVisible, v)}
                    />
                  </SubSection>
                </Card>

                <Card title="Checkout" subtitle="How customers complete their orders">
                  <ToggleRow label="Allow guest checkout" description="Customers can order without an account" checked={checkoutGuest} onChange={(v) => change(setCheckoutGuest, v)} />
                  <ToggleRow label="Require phone number" description="Collect phone number for M-Pesa and delivery" checked={checkoutRequirePhone} onChange={(v) => change(setCheckoutRequirePhone, v)} />
                  <ToggleRow label="Auto-confirm orders" description="Mark orders as confirmed immediately after payment" checked={checkoutAutoConfirm} onChange={(v) => change(setCheckoutAutoConfirm, v)} />
                  <ToggleRow label="WhatsApp fallback" description="Show 'Order on WhatsApp' button if checkout fails" checked={checkoutWhatsAppFallback} onChange={(v) => change(setCheckoutWhatsAppFallback, v)} />
                </Card>

                <Card title="Inventory" subtitle="Stock tracking and backorders">
                  <ToggleRow label="Track inventory" description="Decrease stock automatically on each sale" checked={inventoryTrack} onChange={(v) => change(setInventoryTrack, v)} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                    <Field label="Low stock threshold" value={inventoryLowThreshold} onChange={(v) => change(setInventoryLowThreshold, v)} type="number" />
                  </div>
                  <ToggleRow label="Allow backorders" description="Accept orders when stock is zero" checked={inventoryAllowBackorder} onChange={(v) => change(setInventoryAllowBackorder, v)} />
                  <ToggleRow label="Hide out-of-stock products" description="Remove sold-out products from the storefront" checked={inventoryHideOutOfStock} onChange={(v) => change(setInventoryHideOutOfStock, v)} />
                </Card>

                <Card title="Reviews" subtitle="Customer product reviews and ratings">
                  <ToggleRow label="Enable reviews" description="Let customers leave ratings and comments" checked={reviewsEnabled} onChange={(v) => change(setReviewsEnabled, v)} />
                  <ToggleRow label="Require verified purchase" description="Only buyers can review a product" checked={reviewsRequirePurchase} onChange={(v) => change(setReviewsRequirePurchase, v)} />
                  <ToggleRow label="Auto-publish reviews" description="Show reviews immediately without moderation" checked={reviewsAutoPublish} onChange={(v) => change(setReviewsAutoPublish, v)} />
                  <ToggleRow label="Allow photo uploads" description="Customers can attach images to reviews" checked={reviewsAllowPhotos} onChange={(v) => change(setReviewsAllowPhotos, v)} />
                </Card>
              </>
            )}

            {/* ══════════════ PAYMENTS ══════════════ */}
            {activeTab === 'payments' && (
              <>
                <Card title="Payment gateways" subtitle="Enable or disable the checkout methods you offer">
                  <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 flex items-start gap-2">
                    <Lock className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
                    <p className="text-blue-800 text-[13px]">
                      Gateway credentials (API keys, secrets, shortcodes) are managed by your platform
                      administrator. Contact support to connect a new payment gateway.
                    </p>
                  </div>

                  <ToggleRow label="M-Pesa (Safaricom Daraja)" description="Instant STK Push payments to customer phones" checked={mpesaEnabled} onChange={(v) => change(setMpesaEnabled, v)} />
                  <ToggleRow label="Airtel Money" description="Alternative mobile wallet for Airtel subscribers" checked={airtelEnabled} onChange={(v) => change(setAirtelEnabled, v)} />
                  <ToggleRow label="Stripe" description="International card payments (Visa, Mastercard, Apple Pay)" checked={stripeEnabled} onChange={(v) => change(setStripeEnabled, v)} />
                  <ToggleRow label="Cash on delivery" description="Payment collected by the courier" checked={codEnabled} onChange={(v) => change(setCodEnabled, v)} />
                  {codEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                      <Field label="COD surcharge (KES)" value={codFee} onChange={(v) => change(setCodFee, v)} type="number" />
                    </div>
                  )}
                </Card>

                <Card title="Checkout method order" subtitle="Drag the priority of payment options shown at checkout">
                  <ul className="border border-slate-200 rounded-sm divide-y divide-slate-100">
                    {paymentMethodsOrder.map((method, idx) => (
                      <li key={method} className="p-2 flex items-center justify-between gap-2 text-[13px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-6 h-6 rounded-sm bg-slate-100 text-slate-600 flex items-center justify-center font-mono text-[13px] shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-medium text-slate-900 truncate">{method}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => movePaymentMethod(idx, idx - 1)}
                            disabled={idx === 0}
                            className="p-1.5 rounded-sm border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-30"
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => movePaymentMethod(idx, idx + 1)}
                            disabled={idx === paymentMethodsOrder.length - 1}
                            className="p-1.5 rounded-sm border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-30"
                            title="Move down"
                          >
                            ↓
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card title="Transaction settings" subtitle="Order amount limits and automatic actions">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
                    <Field label="Minimum order (KES)" value={txnMinAmount} onChange={(v) => change(setTxnMinAmount, v)} type="number" />
                    <Field label="Maximum order (KES)" value={txnMaxAmount} onChange={(v) => change(setTxnMaxAmount, v)} type="number" />
                    <Field label="Transaction fee (KES)" value={txnFee} onChange={(v) => change(setTxnFee, v)} type="number" />
                  </div>
                  <ToggleRow label="Auto-capture payments" description="Capture authorized payments immediately" checked={txnAutoCapture} onChange={(v) => change(setTxnAutoCapture, v)} />
                  <ToggleRow label="Auto-refund on cancellation" description="Refund the customer automatically when they cancel" checked={txnAutoRefund} onChange={(v) => change(setTxnAutoRefund, v)} />
                </Card>
              </>
            )}

            {/* ══════════════ SHIPPING ══════════════ */}
            {activeTab === 'shipping' && (
              <>
                <Card title="Shipping basics" subtitle="Enable delivery and set global defaults">
                  <ToggleRow label="Enable shipping" description="Offer delivery at checkout" checked={shippingEnabled} onChange={(v) => change(setShippingEnabled, v)} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                    <Field label="Free shipping above (KES)" value={shippingFreeThreshold} onChange={(v) => change(setShippingFreeThreshold, v)} type="number" />
                    <Field label="Default delivery fee (KES)" value={shippingDefaultFee} onChange={(v) => change(setShippingDefaultFee, v)} type="number" />
                  </div>
                  <ToggleRow label="Local pickup" description="Let customers pick up in person" checked={shippingLocalPickup} onChange={(v) => change(setShippingLocalPickup, v)} />
                </Card>

                <Card title="Delivery providers" subtitle="Courier partners integrated with your store">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
                    <ToggleRow label="G4S Kenya" checked={shippingProviders.g4s} onChange={(v) => change(setShippingProviders, { ...shippingProviders, g4s: v })} />
                    <ToggleRow label="Fargo Courier" checked={shippingProviders.fargo} onChange={(v) => change(setShippingProviders, { ...shippingProviders, fargo: v })} />
                    <ToggleRow label="Sendy" checked={shippingProviders.sendy} onChange={(v) => change(setShippingProviders, { ...shippingProviders, sendy: v })} />
                    <ToggleRow label="SokoFlow Riders" checked={shippingProviders.riders} onChange={(v) => change(setShippingProviders, { ...shippingProviders, riders: v })} />
                  </div>
                </Card>

                <Card title="Delivery zones" subtitle="Region-by-region rates and ETAs">
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => openZoneModal()}
                      className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-2 rounded-sm text-[13px]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add zone
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-sm">
                    <table className="w-full text-left border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-3 font-medium">Zone</th>
                          <th className="py-2 px-3 font-medium">Region</th>
                          <th className="py-2 px-3 font-medium text-right">Fee (KES)</th>
                          <th className="py-2 px-3 font-medium">ETA</th>
                          <th className="py-2 px-3 font-medium">Status</th>
                          <th className="py-2 px-3 w-24"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {deliveryZones.map((z) => (
                          <tr key={z.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-medium text-slate-900">
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {z.name}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-600">{z.region}</td>
                            <td className="py-2 px-3 text-right font-mono">{z.fee}</td>
                            <td className="py-2 px-3 text-slate-600">{z.eta}</td>
                            <td className="py-2 px-3">
                              <button
                                onClick={() => toggleZone(z.id)}
                                className={`inline-block px-2 py-0.5 rounded-sm text-[13px] font-medium border ${
                                  z.enabled
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                              >
                                {z.enabled ? 'Active' : 'Disabled'}
                              </button>
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => openZoneModal(z)} className="p-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700">
                                  <Key className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => deleteZone(z.id)} className="p-2 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}

            {/* ══════════════ NOTIFICATIONS ══════════════ */}
            {activeTab === 'notifications' && (
              <>
                <Card title="Channels" subtitle="Which channels can send notifications">
                  <ToggleRow label="Email notifications" description="Send order and account updates via email" checked={notifEmailEnabled} onChange={(v) => change(setNotifEmailEnabled, v)} />
                  <ToggleRow label="SMS notifications" description="Send short messages through your SMS gateway" checked={notifSmsEnabled} onChange={(v) => change(setNotifSmsEnabled, v)} />
                  <ToggleRow label="WhatsApp notifications" description="Send templated messages through WhatsApp Business API" checked={notifWhatsAppEnabled} onChange={(v) => change(setNotifWhatsAppEnabled, v)} />
                </Card>

                <Card title="Events" subtitle="Pick which events trigger a notification">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
                    <ToggleRow label="New order placed" checked={notifOnNewOrder} onChange={(v) => change(setNotifOnNewOrder, v)} />
                    <ToggleRow label="Payment received" checked={notifOnPayment} onChange={(v) => change(setNotifOnPayment, v)} />
                    <ToggleRow label="Order shipped" checked={notifOnShipped} onChange={(v) => change(setNotifOnShipped, v)} />
                    <ToggleRow label="Order cancelled" checked={notifOnCancelled} onChange={(v) => change(setNotifOnCancelled, v)} />
                    <ToggleRow label="Low stock alert" checked={notifOnLowStock} onChange={(v) => change(setNotifOnLowStock, v)} />
                    <ToggleRow label="New review posted" checked={notifOnReview} onChange={(v) => change(setNotifOnReview, v)} />
                  </div>
                </Card>

                <Card title="Admin recipient" subtitle="Where internal alerts are sent">
                  <Field label="Admin alert email" value={notifAdminEmail} onChange={(v) => change(setNotifAdminEmail, v)} type="email" />
                  <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 flex items-start gap-2 mt-2">
                    <Lock className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
                    <p className="text-blue-800 text-[13px]">
                      SMS gateway credentials and WhatsApp templates are configured by your platform
                      administrator. Contact support to update them.
                    </p>
                  </div>
                </Card>
              </>
            )}

            {/* ══════════════ SECURITY ══════════════ */}
            {activeTab === 'security' && (
              <>
                <Card title="Password" subtitle="Change your admin account password">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
                    <PasswordField label="Current password" value={currentPassword} onChange={setCurrentPassword} />
                    <PasswordField label="New password" value={newPassword} onChange={setNewPassword} />
                    <PasswordField label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        if (!newPassword || newPassword !== confirmPassword) {
                          toast('Passwords do not match');
                          return;
                        }
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                        toast('Password updated');
                      }}
                      className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Update password
                    </button>
                  </div>
                </Card>

                <Card title="Two-factor authentication" subtitle="Add a second step when signing in">
                  <ToggleRow label="Require 2FA at login" description="Recommended for admin accounts" checked={twoFaEnabled} onChange={(v) => change(setTwoFaEnabled, v)} />
                  {twoFaEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
                      {(['authenticator', 'sms'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => change(setTwoFaMethod, m)}
                          className={`p-2 rounded-sm border text-left capitalize transition ${
                            twoFaMethod === m ? 'border-blue-950 bg-blue-50/40 text-blue-950' : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-[13px] font-medium inline-flex items-center gap-1.5">
                            <Smartphone className="w-3.5 h-3.5" />
                            {m === 'authenticator' ? 'Authenticator app' : 'SMS one-time code'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </Card>

                <Card title="Session management" subtitle="Auto-logout and force-close other sessions">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                    <Field label="Session timeout (minutes)" value={sessionTimeout} onChange={(v) => change(setSessionTimeout, v)} type="number" />
                  </div>

                  <SubSection title="Active sessions">
                    <ul className="divide-y divide-slate-100 border border-slate-200 rounded-sm">
                      {sessions.map((s) => (
                        <li key={s.id} className="p-2 flex items-center justify-between gap-2 text-[13px]">
                          <div className="flex items-center gap-2 min-w-0">
                            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">{s.device}</p>
                              <p className="text-[13px] text-slate-400 font-mono truncate">
                                {s.ip} · {s.started}
                              </p>
                            </div>
                          </div>
                          {s.current ? (
                            <span className="inline-block px-2 py-0.5 rounded-sm text-[13px] bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                              This device
                            </span>
                          ) : (
                            <button
                              onClick={() => revokeSession(s.id)}
                              className="inline-flex items-center gap-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-medium px-2.5 py-1.5 rounded-sm text-[13px] shrink-0"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              Revoke
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </SubSection>
                </Card>

                <Card title="Login history" subtitle="Recent authentication events on your account">
                  <ul className="divide-y divide-slate-100 border border-slate-200 rounded-sm">
                    {loginHistory.map((l) => (
                      <li key={l.id} className="p-2 flex items-center justify-between gap-2 text-[13px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <LogIn className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{l.device}</p>
                            <p className="text-[13px] text-slate-400 font-mono truncate">
                              {l.ip} · {l.location}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[13px] text-slate-400 font-mono shrink-0">
                          <Clock className="w-3 h-3" />
                          {l.time}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </>
            )}

            {/* ══════════════ INTEGRATIONS (status only) ══════════════ */}
            {activeTab === 'integrations' && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 flex items-start gap-2">
                  <Globe className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
                  <div className="text-[13px] flex-1 min-w-0">
                    <p className="font-medium text-blue-950">Read-only integration status</p>
                    <p className="text-blue-800 mt-0.5">
                      Connecting, disconnecting, and configuring integrations is handled by your
                      platform administrator. This view shows what's currently active.
                    </p>
                  </div>
                </div>

                <Card title="Payment APIs" subtitle="Mobile money and card processors">
                  <IntegrationGrid items={integrations.filter((i) => i.category === 'Payments')} />
                </Card>

                <Card title="Messaging" subtitle="Customer communication channels">
                  <IntegrationGrid items={integrations.filter((i) => i.category === 'Messaging')} />
                </Card>

                <Card title="Analytics" subtitle="Traffic and conversion tracking">
                  <IntegrationGrid items={integrations.filter((i) => i.category === 'Analytics')} />
                </Card>

                <Card title="Social APIs" subtitle="Shops, pixels, and catalog sync">
                  <IntegrationGrid items={integrations.filter((i) => i.category === 'Social')} />
                </Card>
              </>
            )}

            {/* ══════════════ TAX ══════════════ */}
            {activeTab === 'tax' && (
              <Card title="Tax preferences" subtitle="VAT calculation and statutory invoicing">
                <SubSection title="VAT">
                  <ToggleRow label="Enable VAT calculation" description="Automatically add value-added tax to checkout orders" checked={vatEnabled} onChange={(v) => change(setVatEnabled, v)} />
                  {vatEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                      <Field label="Default VAT rate (%)" value={vatRate} onChange={(v) => change(setVatRate, v)} type="number" />
                      <div className="flex items-end pb-2">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pricesIncludeTax}
                            onChange={(e) => change(setPricesIncludeTax, e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950"
                          />
                          <span className="font-medium text-slate-700">Catalog prices include VAT</span>
                        </label>
                      </div>
                    </div>
                  )}
                </SubSection>

                <SubSection title="KRA eTIMS fiscal invoices">
                  <ToggleRow label="Enable eTIMS on paid orders" description="Auto-submit tax invoices to KRA eTIMS when payments succeed" checked={etimsEnabled} onChange={(v) => change(setEtimsEnabled, v)} />
                  <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 flex items-start gap-2">
                    <Lock className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
                    <p className="text-blue-800 text-[13px]">
                      KRA PIN, control unit ID, and eTIMS API credentials are managed by your platform
                      administrator. Contact support to update them.
                    </p>
                  </div>
                </SubSection>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* UNSAVED CHANGES */}
      {showUnsavedPrompt && (
        <div
          className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => {
            setShowUnsavedPrompt(false);
            setPendingTab(null);
          }}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl text-center space-y-3 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-sm bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Unsaved changes</h3>
              <p className="text-slate-500 mt-1">
                You have modified settings on this tab. Discard your changes and switch?
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => {
                  setShowUnsavedPrompt(false);
                  setPendingTab(null);
                }}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]"
              >
                Keep editing
              </button>
              <button
                onClick={confirmTabSwitch}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-sm text-[13px]"
              >
                Discard & switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ZONE MODAL */}
      {isZoneModalOpen && (
        <div
          className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setIsZoneModalOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl space-y-3 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-slate-900">
                {editingZone ? 'Edit delivery zone' : 'New delivery zone'}
              </h3>
              <button
                onClick={() => setIsZoneModalOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Zone name" value={zoneName} onChange={setZoneName} />
              <Field label="Region" value={zoneRegion} onChange={setZoneRegion} />
              <Field label="Fee (KES)" value={zoneFee} onChange={setZoneFee} type="number" />
              <Field label="ETA" value={zoneEta} onChange={setZoneEta} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setIsZoneModalOpen(false)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]">
                Cancel
              </button>
              <button onClick={saveZone} className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]">
                Save zone
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================
function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
      <header>
        <p className="text-[15px] font-semibold text-slate-900">{title}</p>
        {subtitle && <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-3 mt-3 border-t border-slate-100 first:pt-0 first:mt-0 first:border-0 space-y-2">
      <p className="text-[13px] font-medium text-slate-700">{title}</p>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block font-medium text-slate-700 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
      />
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block font-medium text-slate-700 mb-1">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <label className="block">
      <span className="block font-medium text-slate-700 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 border rounded-sm p-2 cursor-pointer bg-slate-50 border-slate-200">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-900">{label}</p>
        {description && <p className="text-[13px] text-slate-500 mt-0.5">{description}</p>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950"
      />
    </label>
  );
}

function IntegrationGrid({ items }: { items: IntegrationStatus[] }) {
  if (items.length === 0) {
    return <p className="text-[13px] text-slate-400 italic">No integrations in this category.</p>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item.id} className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 h-8 rounded-sm bg-slate-100 border border-slate-200 flex items-center justify-center text-[13px] font-medium text-slate-700 shrink-0">
                {item.name.charAt(0)}
              </span>
              <p className="text-[13px] font-medium text-slate-900 truncate">{item.name}</p>
            </div>
            <span
              className={`inline-block px-2 py-0.5 rounded-sm text-[13px] font-medium border shrink-0 ${
                item.connected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              {item.connected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <p className="text-[13px] text-slate-500 leading-relaxed">{item.description}</p>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[13px] font-mono text-slate-400 uppercase tracking-wide">
              {item.category}
            </span>
            <span className="text-[13px] text-slate-400">Managed by admin</span>
          </div>
        </div>
      ))}
    </div>
  );
}