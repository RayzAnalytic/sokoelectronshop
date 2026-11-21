'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Info,
  Save,
  Building,
  Receipt,
  Plug,
  X,
  AlertTriangle,
  Store,
  CreditCard,
  Truck,
  Bell,
  ShieldCheck,
  Smartphone,
  Plus,
  Trash2,
  Lock,
  MapPin,
  Users,
  UserX,
  LogIn,
  Clock,
  Copy,
  Loader2,
  RefreshCw,
  RotateCcw,
  Mail,
  Banknote,
} from 'lucide-react';

import { adminApi } from '@/lib/admin-api';
import type {
  AdminCurrency,
  AdminTimezone,
  AdminDateFormat,
  AdminWeightUnit,
  AdminStoreStatusValue,
  AdminMpesaStatus,
  AdminShippingProvider,
  AdminShippingProviderKey,
  AdminDeliveryZone,
  AdminWhatsAppStatus,
  AdminActiveSession,
  AdminLoginEvent,
  AdminIntegrationStatus,
} from '@/lib/admin-types';

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

type ToastKind = 'success' | 'error' | 'info';

interface ToastState {
  kind: ToastKind;
  message: string;
}

interface GeneralDraft {
  business_name: string;
  tagline: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  currency: AdminCurrency;
  timezone: AdminTimezone;
  date_format: AdminDateFormat;
  weight_unit: AdminWeightUnit;
}

interface StoreDraft {
  status: AdminStoreStatusValue;
  is_indexable: boolean;
  paused_message: string;
}

interface CheckoutDraft {
  allow_guest_checkout: boolean;
  require_phone: boolean;
  auto_confirm_orders: boolean;
  whatsapp_fallback: boolean;
}

interface InventoryDraft {
  track_inventory: boolean;
  low_stock_threshold: string;
  allow_backorders: boolean;
  hide_out_of_stock: boolean;
}

interface ReviewsDraft {
  reviews_enabled: boolean;
  require_verified_purchase: boolean;
  auto_publish: boolean;
  allow_photos: boolean;
}

interface PaymentsDraft {
  mpesa_enabled: boolean;
  min_amount_kes: string;
  max_amount_kes: string;
  transaction_fee_kes: string;
  auto_capture: boolean;
  auto_refund: boolean;
}

interface ShippingDraft {
  shipping_enabled: boolean;
  free_shipping_threshold_kes: string;
  default_delivery_fee_kes: string;
  local_pickup_enabled: boolean;
}

interface NotificationsDraft {
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  notify_on_new_order: boolean;
  notify_on_payment: boolean;
  notify_on_shipped: boolean;
  notify_on_cancelled: boolean;
  notify_on_low_stock: boolean;
  notify_on_review: boolean;
  admin_alert_email: string;
}

interface SecurityDraft {
  session_timeout_minutes: string;
  require_2fa: boolean;
}

interface TaxDraft {
  vat_enabled: boolean;
  vat_rate: string;
  prices_include_tax: boolean;
  etims_enabled: boolean;
}

interface ZoneRow {
  id: number | null;
  name: string;
  region: string;
  fee_kes: string;
  eta_text: string;
  enabled: boolean;
}

interface ZoneDraft {
  name: string;
  region: string;
  fee_kes: string;
  eta_text: string;
  enabled: boolean;
}

const EMPTY_ZONE: ZoneDraft = {
  name: '',
  region: '',
  fee_kes: '',
  eta_text: '',
  enabled: true,
};

const MIN_PASSWORD_LENGTH = 8;


type IconProps = { className?: string; 'aria-hidden'?: boolean };

function WhatsAppIcon({ className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={className}
      {...rest}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

function TikTokIcon({ className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={className}
      {...rest}
    >
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function InstagramIcon({ className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={className}
      {...rest}
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function FacebookIcon({ className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={className}
      {...rest}
    >
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 011.141.195v3.325a8.623 8.623 0 00-.653-.036 26.805 26.805 0 00-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 00-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  );
}

function YouTubeIcon({ className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={className}
      {...rest}
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function TelegramIcon({ className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={className}
      {...rest}
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function DiscordIcon({ className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={className}
      {...rest}
    >
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}
const SOCIAL_ICON_MAP: Record<string, React.ComponentType<IconProps>> = {
  whatsapp: WhatsAppIcon,
  'whats-app': WhatsAppIcon,
  wa: WhatsAppIcon,
  tiktok: TikTokIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  youtube: YouTubeIcon,
  telegram: TelegramIcon,
  discord: DiscordIcon,
};

function normaliseIntegrationKey(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

function resolveSocialIcon(
  item: AdminIntegrationStatus,
): React.ComponentType<IconProps> | null {
  if (!item) return null;

  const key = normaliseIntegrationKey(item.key || '');
  if (key && SOCIAL_ICON_MAP[key]) return SOCIAL_ICON_MAP[key];

  const name = normaliseIntegrationKey(item.name || '');
  if (name && SOCIAL_ICON_MAP[name]) return SOCIAL_ICON_MAP[name];

  const haystack = `${key} ${name}`;
  for (const [k, icon] of Object.entries(SOCIAL_ICON_MAP)) {
    if (haystack.includes(k)) return icon;
  }

  return null;
}
const EXCLUDED_INTEGRATION_KEYS = new Set<string>([
  'twitter',
  'x',
  'twitter_x',
  'twitterx',
  'twilio',
]);

const EXCLUDED_INTEGRATION_NAME_PATTERNS: RegExp[] = [
  /^twitter$/i,
  /^x$/i,
  /twitter\s*\/\s*x/i,
  /twitter\s+\(x\)/i,
  /x\s+\(twitter\)/i,
  /^twilio$/i,
  /\btwilio\b/i,
];

function isExcludedIntegration(item: AdminIntegrationStatus): boolean {
  const key = (item.key || '').toLowerCase();
  if (EXCLUDED_INTEGRATION_KEYS.has(key)) return true;
  const name = (item.name || '').trim();
  return EXCLUDED_INTEGRATION_NAME_PATTERNS.some((re) => re.test(name));
}
const TABS: {
  id: SettingsTab;
  label: string;
  saveLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'general', label: 'General', saveLabel: 'Save general', icon: Building },
  { id: 'store', label: 'Store', saveLabel: 'Save store', icon: Store },
  { id: 'payments', label: 'Payments', saveLabel: 'Save payments', icon: CreditCard },
  { id: 'shipping', label: 'Shipping', saveLabel: 'Save shipping', icon: Truck },
  { id: 'notifications', label: 'Notifications', saveLabel: 'Save notifications', icon: Bell },
  { id: 'security', label: 'Security', saveLabel: 'Save security', icon: ShieldCheck },
  { id: 'integrations', label: 'Integrations', saveLabel: 'Read-only', icon: Plug },
  { id: 'tax', label: 'Tax', saveLabel: 'Save tax', icon: Receipt },
];
export default function StoreSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const [pendingTab, setPendingTab] = useState<SettingsTab | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingIntegrations, setRefreshingIntegrations] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [general, setGeneral] = useState<GeneralDraft>({
    business_name: '',
    tagline: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    currency: 'KES',
    timezone: 'Africa/Nairobi',
    date_format: 'DD/MM/YYYY',
    weight_unit: 'kg',
  });

  const [store, setStore] = useState<StoreDraft>({
    status: 'open',
    is_indexable: true,
    paused_message: '',
  });
  const [checkout, setCheckout] = useState<CheckoutDraft>({
    allow_guest_checkout: true,
    require_phone: true,
    auto_confirm_orders: false,
    whatsapp_fallback: true,
  });
  const [inventory, setInventory] = useState<InventoryDraft>({
    track_inventory: true,
    low_stock_threshold: '5',
    allow_backorders: false,
    hide_out_of_stock: false,
  });
  const [reviews, setReviews] = useState<ReviewsDraft>({
    reviews_enabled: true,
    require_verified_purchase: true,
    auto_publish: false,
    allow_photos: true,
  });

  const [payments, setPayments] = useState<PaymentsDraft>({
    mpesa_enabled: true,
    min_amount_kes: '100',
    max_amount_kes: '500000',
    transaction_fee_kes: '0',
    auto_capture: true,
    auto_refund: true,
  });
  const [mpesaStatus, setMpesaStatus] = useState<AdminMpesaStatus | null>(null);

  const [shipping, setShipping] = useState<ShippingDraft>({
    shipping_enabled: true,
    free_shipping_threshold_kes: '5000',
    default_delivery_fee_kes: '250',
    local_pickup_enabled: true,
  });
  const [providers, setProviders] = useState<AdminShippingProvider[]>([]);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ZoneRow | null>(null);
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft>(EMPTY_ZONE);
  const [pendingZoneDelete, setPendingZoneDelete] = useState<ZoneRow | null>(null);

  const [notifications, setNotifications] = useState<NotificationsDraft>({
    email_enabled: true,
    whatsapp_enabled: true,
    notify_on_new_order: true,
    notify_on_payment: true,
    notify_on_shipped: true,
    notify_on_cancelled: true,
    notify_on_low_stock: true,
    notify_on_review: false,
    admin_alert_email: '',
  });
  const [whatsappStatus, setWhatsappStatus] = useState<AdminWhatsAppStatus | null>(null);

  const [security, setSecurity] = useState<SecurityDraft>({
    session_timeout_minutes: '60',
    require_2fa: true,
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [sessions, setSessions] = useState<AdminActiveSession[]>([]);
  const [loginHistory, setLoginHistory] = useState<AdminLoginEvent[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [integrations, setIntegrations] = useState<AdminIntegrationStatus[]>([]);

  const [tax, setTax] = useState<TaxDraft>({
    vat_enabled: true,
    vat_rate: '16',
    prices_include_tax: true,
    etims_enabled: true,
  });

  const snapshotRef = useRef<Record<SettingsTab, () => void> | null>(null);

  // ── EFFECTS ──
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!showUnsavedPrompt && !isZoneModalOpen && !pendingZoneDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isZoneModalOpen) setIsZoneModalOpen(false);
      else if (pendingZoneDelete) setPendingZoneDelete(null);
      else {
        setShowUnsavedPrompt(false);
        setPendingTab(null);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [showUnsavedPrompt, isZoneModalOpen, pendingZoneDelete]);

  const notify = (message: string, kind: ToastKind = 'success') =>
    setToast({ message, kind });

  const hydrateGeneral = useCallback((g: Awaited<ReturnType<typeof adminApi.settings.general.get>>) => {
    setGeneral({
      business_name: g.business_name,
      tagline: g.tagline,
      contact_email: g.contact_email,
      contact_phone: g.contact_phone,
      address: g.address,
      currency: g.currency,
      timezone: g.timezone,
      date_format: g.date_format,
      weight_unit: g.weight_unit,
    });
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [
        generalRes,
        storeRes,
        checkoutRes,
        inventoryRes,
        reviewsRes,
        paymentsRes,
        mpesaStatusRes,
        shippingRes,
        providersRes,
        zonesRes,
        notifsRes,
        waStatusRes,
        securityRes,
        integrationsRes,
        taxRes,
      ] = await Promise.all([
        adminApi.settings.general.get(),
        adminApi.settings.store.get(),
        adminApi.settings.checkout.get(),
        adminApi.settings.inventory.get(),
        adminApi.settings.reviews.get(),
        adminApi.settings.payments.get(),
        adminApi.settings.payments.mpesaStatus().catch(() => null),
        adminApi.settings.shipping.get(),
        adminApi.settings.shipping.providers.list(),
        adminApi.settings.shipping.zones.list(),
        adminApi.settings.notifications.get(),
        adminApi.settings.notifications.whatsappStatus().catch(() => null),
        adminApi.settings.security.get(),
        adminApi.settings.integrations.list(),
        adminApi.settings.tax.get(),
      ]);

      hydrateGeneral(generalRes);

      setStore({
        status: storeRes.status,
        is_indexable: storeRes.is_indexable,
        paused_message: storeRes.paused_message,
      });
      setCheckout({ ...checkoutRes });
      setInventory({
        track_inventory: inventoryRes.track_inventory,
        low_stock_threshold: String(inventoryRes.low_stock_threshold),
        allow_backorders: inventoryRes.allow_backorders,
        hide_out_of_stock: inventoryRes.hide_out_of_stock,
      });
      setReviews({ ...reviewsRes });

      setPayments({
        mpesa_enabled: paymentsRes.mpesa_enabled,
        min_amount_kes: paymentsRes.min_amount_kes,
        max_amount_kes: paymentsRes.max_amount_kes,
        transaction_fee_kes: paymentsRes.transaction_fee_kes,
        auto_capture: paymentsRes.auto_capture,
        auto_refund: paymentsRes.auto_refund,
      });
      setMpesaStatus(mpesaStatusRes);

      setShipping({
        shipping_enabled: shippingRes.shipping_enabled,
        free_shipping_threshold_kes: shippingRes.free_shipping_threshold_kes,
        default_delivery_fee_kes: shippingRes.default_delivery_fee_kes,
        local_pickup_enabled: shippingRes.local_pickup_enabled,
      });
      setProviders(providersRes);
      setZones(
        zonesRes.map((z: AdminDeliveryZone) => ({
          id: z.id,
          name: z.name,
          region: z.region,
          fee_kes: z.fee_kes,
          eta_text: z.eta_text,
          enabled: z.enabled,
        })),
      );

      setNotifications({ ...notifsRes });
      setWhatsappStatus(waStatusRes);

      setSecurity({
        session_timeout_minutes: String(securityRes.session_timeout_minutes),
        require_2fa: securityRes.require_2fa,
      });

      setIntegrations(integrationsRes.filter((i) => !isExcludedIntegration(i)));

      setTax({
        vat_enabled: taxRes.vat_enabled,
        vat_rate: taxRes.vat_rate,
        prices_include_tax: taxRes.prices_include_tax,
        etims_enabled: taxRes.etims_enabled,
      });

      setHasUnsavedChanges(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [hydrateGeneral]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    snapshotRef.current = {
      general: () => void adminApi.settings.general.get().then(hydrateGeneral),
      store: () => void adminApi.settings.store.get().then((r) => setStore({ ...r })),
      payments: () =>
        void adminApi.settings.payments.get().then((r) =>
          setPayments({
            mpesa_enabled: r.mpesa_enabled,
            min_amount_kes: r.min_amount_kes,
            max_amount_kes: r.max_amount_kes,
            transaction_fee_kes: r.transaction_fee_kes,
            auto_capture: r.auto_capture,
            auto_refund: r.auto_refund,
          }),
        ),
      shipping: () =>
        void adminApi.settings.shipping.get().then((r) =>
          setShipping({
            shipping_enabled: r.shipping_enabled,
            free_shipping_threshold_kes: r.free_shipping_threshold_kes,
            default_delivery_fee_kes: r.default_delivery_fee_kes,
            local_pickup_enabled: r.local_pickup_enabled,
          }),
        ),
      notifications: () =>
        void adminApi.settings.notifications.get().then((r) =>
          setNotifications({ ...r }),
        ),
      security: () =>
        void adminApi.settings.security.get().then((r) =>
          setSecurity({
            session_timeout_minutes: String(r.session_timeout_minutes),
            require_2fa: r.require_2fa,
          }),
        ),
      integrations: () => void refreshIntegrations(),
      tax: () =>
        void adminApi.settings.tax.get().then((r) =>
          setTax({
            vat_enabled: r.vat_enabled,
            vat_rate: r.vat_rate,
            prices_include_tax: r.prices_include_tax,
            etims_enabled: r.etims_enabled,
          }),
        ),
    };
  }, [hydrateGeneral]);

  const loadSecurityExtras = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const [sessRes, histRes] = await Promise.all([
        adminApi.settings.security.sessions.list(),
        adminApi.settings.security.loginHistory(),
      ]);
      setSessions(sessRes);
      setLoginHistory(histRes);
    } catch {
      /* non-fatal */
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'security') void loadSecurityExtras();
  }, [activeTab, loadSecurityExtras]);

  const markDirty = () => setHasUnsavedChanges(true);

  const changeGeneral = <K extends keyof GeneralDraft>(k: K, v: GeneralDraft[K]) => {
    setGeneral((s) => ({ ...s, [k]: v }));
    markDirty();
  };
  const changeStore = <K extends keyof StoreDraft>(k: K, v: StoreDraft[K]) => {
    setStore((s) => ({ ...s, [k]: v }));
    markDirty();
  };
  const changeCheckout = <K extends keyof CheckoutDraft>(k: K, v: CheckoutDraft[K]) => {
    setCheckout((s) => ({ ...s, [k]: v }));
    markDirty();
  };
  const changeInventory = <K extends keyof InventoryDraft>(k: K, v: InventoryDraft[K]) => {
    setInventory((s) => ({ ...s, [k]: v }));
    markDirty();
  };
  const changeReviews = <K extends keyof ReviewsDraft>(k: K, v: ReviewsDraft[K]) => {
    setReviews((s) => ({ ...s, [k]: v }));
    markDirty();
  };
  const changePayments = <K extends keyof PaymentsDraft>(k: K, v: PaymentsDraft[K]) => {
    setPayments((s) => ({ ...s, [k]: v }));
    markDirty();
  };
  const changeShipping = <K extends keyof ShippingDraft>(k: K, v: ShippingDraft[K]) => {
    setShipping((s) => ({ ...s, [k]: v }));
    markDirty();
  };
  const changeNotifications = <K extends keyof NotificationsDraft>(
    k: K,
    v: NotificationsDraft[K],
  ) => {
    setNotifications((s) => ({ ...s, [k]: v }));
    markDirty();
  };
  const changeSecurity = <K extends keyof SecurityDraft>(k: K, v: SecurityDraft[K]) => {
    setSecurity((s) => ({ ...s, [k]: v }));
    markDirty();
  };
  const changeTax = <K extends keyof TaxDraft>(k: K, v: TaxDraft[K]) => {
    setTax((s) => ({ ...s, [k]: v }));
    markDirty();
  };

  const saveActiveTab = async () => {
    if (activeTab === 'integrations') return;
    setSaving(true);
    try {
      switch (activeTab) {
        case 'general': {
          const r = await adminApi.settings.general.update(general);
          hydrateGeneral(r);
          break;
        }
        case 'store': {
          const [s, c, i, rv] = await Promise.all([
            adminApi.settings.store.update(store),
            adminApi.settings.checkout.update(checkout),
            adminApi.settings.inventory.update({
              ...inventory,
              low_stock_threshold: Number(inventory.low_stock_threshold) || 0,
            }),
            adminApi.settings.reviews.update(reviews),
          ]);
          setStore({ ...s });
          setCheckout({ ...c });
          setInventory({
            track_inventory: i.track_inventory,
            low_stock_threshold: String(i.low_stock_threshold),
            allow_backorders: i.allow_backorders,
            hide_out_of_stock: i.hide_out_of_stock,
          });
          setReviews({ ...rv });
          break;
        }
        case 'payments': {
          const r = await adminApi.settings.payments.update(payments);
          setPayments({
            mpesa_enabled: r.mpesa_enabled,
            min_amount_kes: r.min_amount_kes,
            max_amount_kes: r.max_amount_kes,
            transaction_fee_kes: r.transaction_fee_kes,
            auto_capture: r.auto_capture,
            auto_refund: r.auto_refund,
          });
          break;
        }
        case 'shipping': {
          const r = await adminApi.settings.shipping.update(shipping);
          setShipping({
            shipping_enabled: r.shipping_enabled,
            free_shipping_threshold_kes: r.free_shipping_threshold_kes,
            default_delivery_fee_kes: r.default_delivery_fee_kes,
            local_pickup_enabled: r.local_pickup_enabled,
          });
          break;
        }
        case 'notifications': {
          const r = await adminApi.settings.notifications.update(notifications);
          setNotifications({ ...r });
          break;
        }
        case 'security': {
          const r = await adminApi.settings.security.update({
            session_timeout_minutes: Number(security.session_timeout_minutes) || 60,
            require_2fa: security.require_2fa,
          });
          setSecurity({
            session_timeout_minutes: String(r.session_timeout_minutes),
            require_2fa: r.require_2fa,
          });
          break;
        }
        case 'tax': {
          const r = await adminApi.settings.tax.update(tax);
          setTax({
            vat_enabled: r.vat_enabled,
            vat_rate: r.vat_rate,
            prices_include_tax: r.prices_include_tax,
            etims_enabled: r.etims_enabled,
          });
          break;
        }
      }
      setHasUnsavedChanges(false);
      notify('Settings saved');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = async () => {
    const restore = snapshotRef.current?.[activeTab];
    if (!restore) return;
    setSaving(true);
    try {
      await restore();
      setHasUnsavedChanges(false);
      notify('Changes discarded', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to discard changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTabClick = (tab: SettingsTab) => {
    if (tab === activeTab) return;
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

  const copyToClipboard = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    notify(`${label} copied`, 'info');
  };

  const refreshIntegrations = async () => {
    setRefreshingIntegrations(true);
    try {
      const r = await adminApi.settings.integrations.refresh();
      setIntegrations(r.filter((i) => !isExcludedIntegration(i)));
      notify('Integration status refreshed', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to refresh status', 'error');
    } finally {
      setRefreshingIntegrations(false);
    }
  };

  const openZoneModal = (z?: ZoneRow) => {
    if (z) {
      setEditingZone(z);
      setZoneDraft({
        name: z.name,
        region: z.region,
        fee_kes: z.fee_kes,
        eta_text: z.eta_text,
        enabled: z.enabled,
      });
    } else {
      setEditingZone(null);
      setZoneDraft(EMPTY_ZONE);
    }
    setIsZoneModalOpen(true);
  };

  const saveZone = async () => {
    if (!zoneDraft.name.trim()) {
      notify('Zone name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingZone && editingZone.id !== null) {
        const r = await adminApi.settings.shipping.zones.update(editingZone.id, {
          name: zoneDraft.name,
          region: zoneDraft.region,
          fee_kes: zoneDraft.fee_kes,
          eta_text: zoneDraft.eta_text,
          enabled: zoneDraft.enabled,
        });
        setZones((prev) =>
          prev.map((z) =>
            z.id === r.id
              ? {
                  id: r.id,
                  name: r.name,
                  region: r.region,
                  fee_kes: r.fee_kes,
                  eta_text: r.eta_text,
                  enabled: r.enabled,
                }
              : z,
          ),
        );
        notify('Zone updated');
      } else {
        const r = await adminApi.settings.shipping.zones.create({
          name: zoneDraft.name,
          region: zoneDraft.region,
          fee_kes: zoneDraft.fee_kes,
          eta_text: zoneDraft.eta_text,
          enabled: zoneDraft.enabled,
        });
        setZones((prev) => [
          ...prev,
          {
            id: r.id,
            name: r.name,
            region: r.region,
            fee_kes: r.fee_kes,
            eta_text: r.eta_text,
            enabled: r.enabled,
          },
        ]);
        notify('Zone added');
      }
      setIsZoneModalOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save zone', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteZone = async () => {
    const z = pendingZoneDelete;
    if (!z || z.id === null) {
      setPendingZoneDelete(null);
      return;
    }
    try {
      await adminApi.settings.shipping.zones.remove(z.id);
      setZones((prev) => prev.filter((row) => row.id !== z.id));
      notify('Zone removed', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to remove zone', 'error');
    } finally {
      setPendingZoneDelete(null);
    }
  };

  const toggleZone = async (id: number | null) => {
    if (id === null) return;
    const zone = zones.find((z) => z.id === id);
    if (!zone) return;
    try {
      const r = await adminApi.settings.shipping.zones.update(id, {
        enabled: !zone.enabled,
      });
      setZones((prev) => prev.map((z) => (z.id === id ? { ...z, enabled: r.enabled } : z)));
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to toggle zone', 'error');
    }
  };

  const toggleProvider = async (key: AdminShippingProviderKey) => {
    const provider = providers.find((p) => p.key === key);
    if (!provider) return;
    try {
      const r = await adminApi.settings.shipping.providers.update(key, {
        enabled: !provider.enabled,
      });
      setProviders((prev) => prev.map((p) => (p.key === key ? r : p)));
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update provider', 'error');
    }
  };

  const changePassword = async () => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      notify(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      notify('Passwords do not match', 'error');
      return;
    }
    setChangingPassword(true);
    try {
      await adminApi.settings.security.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      notify('Password updated');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to change password', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  const revokeSession = async (sessionKey: string) => {
    try {
      await adminApi.settings.security.sessions.revoke(sessionKey);
      setSessions((prev) => prev.filter((s) => s.id !== sessionKey));
      notify('Session revoked', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to revoke session', 'error');
    }
  };

  const paymentIntegrations = integrations.filter((i) => i.category === 'Payments');
  const messagingIntegrations = integrations.filter((i) => i.category === 'Messaging');
  const socialAppIntegrations = integrations.filter((i) => i.category === 'Social app');
  const socialIntegrations = integrations.filter((i) => i.category === 'Social');
  const analyticsIntegrations = integrations.filter((i) => i.category === 'Analytics');


  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[13px]">Loading settings…</span>
        </div>
      </div>
    );
  }

  const activeTabDef = TABS.find((t) => t.id === activeTab);
  const isIntegrationsTab = activeTab === 'integrations';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">
      {/* TOAST */}
      {toast && (
        <div
          className={`fixed bottom-2 right-2 z-[120] text-white px-3 py-2 rounded shadow flex items-center gap-2 text-[13px] ${toast.kind === 'success'
              ? 'bg-slate-900'
              : toast.kind === 'error'
                ? 'bg-red-700'
                : 'bg-slate-700'
            }`}
        >
          {toast.kind === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
          {toast.kind === 'error' && <XCircle className="w-3.5 h-3.5 text-red-200 shrink-0" />}
          {toast.kind === 'info' && <Info className="w-3.5 h-3.5 text-blue-200 shrink-0" />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-slate-300 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1700px] mx-auto px-2 py-2 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Store settings</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Identity, storefront behavior, M-Pesa checkout, shipping, WhatsApp notifications, and
              security
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <span className="hidden sm:inline-block text-[13px] font-medium text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded">
                Unsaved changes
              </span>
            )}
            {hasUnsavedChanges && !isIntegrationsTab && (
              <button
                onClick={discardChanges}
                disabled={saving}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60 text-slate-700 font-medium px-3 py-2 rounded text-[13px] transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Discard</span>
              </button>
            )}
            <button
              onClick={saveActiveTab}
              disabled={saving || !hasUnsavedChanges || isIntegrationsTab}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium px-3 py-2 rounded text-[13px] transition"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{saving ? 'Saving…' : activeTabDef?.saveLabel ?? 'Save changes'}</span>
            </button>
          </div>
        </div>
      </header>

      {loadError && (
        <div className="max-w-[1700px] mx-auto px-2 pt-2">
          <div className="bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-red-900">Couldn&apos;t load settings</p>
              <p className="text-[13px] text-red-800 mt-0.5">{loadError}</p>
            </div>
            <button
              onClick={() => void loadAll()}
              className="text-[13px] font-medium text-red-900 hover:underline shrink-0"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <main className="max-w-[1700px] mx-auto px-0.5 py-2">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* SIDEBAR */}
          <aside className="lg:col-span-3">
            <nav className="bg-white border border-slate-200 rounded p-1.5 space-y-0.5 lg:sticky lg:top-20">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded text-[13px] font-medium transition ${
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
          <div className="lg:col-span-9 space-y-2"> 
            {activeTab === 'general' && (
              <Card
                title="General information"
                subtitle="Business name, contact details, and regional formatting"
              >
                <SubSection title="Business identity">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                    <Field
                      label="Business name"
                      value={general.business_name}
                      onChange={(v) => changeGeneral('business_name', v)}
                      disabled={saving}
                    />
                    <Field
                      label="Tagline"
                      value={general.tagline}
                      onChange={(v) => changeGeneral('tagline', v)}
                      disabled={saving}
                    />
                  </div>
                </SubSection>

                <SubSection title="Contact">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                    <Field
                      label="Email"
                      value={general.contact_email}
                      onChange={(v) => changeGeneral('contact_email', v)}
                      type="email"
                      disabled={saving}
                    />
                    <Field
                      label="Phone"
                      value={general.contact_phone}
                      onChange={(v) => changeGeneral('contact_phone', v)}
                      disabled={saving}
                    />
                    <div className="sm:col-span-2">
                      <Field
                        label="Address"
                        value={general.address}
                        onChange={(v) => changeGeneral('address', v)}
                        disabled={saving}
                      />
                    </div>
                  </div>
                </SubSection>

                <SubSection title="Regional">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                    <SelectField
                      label="Currency"
                      value={general.currency}
                      onChange={(v) => changeGeneral('currency', v as AdminCurrency)}
                      options={[
                        { v: 'KES', l: 'KES (Kenyan Shilling)' },
                        { v: 'USD', l: 'USD ($ US Dollar)' },
                        { v: 'EUR', l: 'EUR (€ Euro)' },
                      ]}
                      disabled={saving}
                    />
                    <SelectField
                      label="Timezone"
                      value={general.timezone}
                      onChange={(v) => changeGeneral('timezone', v as AdminTimezone)}
                      options={[
                        { v: 'Africa/Nairobi', l: 'Africa/Nairobi (GMT+3)' },
                        { v: 'UTC', l: 'UTC (GMT+0)' },
                      ]}
                      disabled={saving}
                    />
                    <SelectField
                      label="Date format"
                      value={general.date_format}
                      onChange={(v) => changeGeneral('date_format', v as AdminDateFormat)}
                      options={[
                        { v: 'DD/MM/YYYY', l: 'DD/MM/YYYY' },
                        { v: 'MM/DD/YYYY', l: 'MM/DD/YYYY' },
                        { v: 'YYYY-MM-DD', l: 'YYYY-MM-DD' },
                      ]}
                      disabled={saving}
                    />
                    <SelectField
                      label="Weight unit"
                      value={general.weight_unit}
                      onChange={(v) => changeGeneral('weight_unit', v as AdminWeightUnit)}
                      options={[
                        { v: 'kg', l: 'Kilogram (kg)' },
                        { v: 'g', l: 'Gram (g)' },
                        { v: 'lb', l: 'Pound (lb)' },
                      ]}
                      disabled={saving}
                    />
                  </div>
                </SubSection>
              </Card>
            )} 
            {activeTab === 'store' && (
              <>
                <Card title="Store status" subtitle="Control public visibility and availability">
                  <SubSection title="Status">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[13px]">
                      {(['open', 'closed', 'paused'] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => changeStore('status', st)}
                          disabled={saving}
                          className={`p-2 rounded border text-left capitalize transition disabled:opacity-60 ${
                            store.status === st
                              ? 'border-blue-950 bg-blue-50/40 text-blue-950'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-[13px] font-medium">{st}</span>
                        </button>
                      ))}
                    </div>
                    {store.status === 'paused' && (
                      <Field
                        label="Paused message"
                        value={store.paused_message}
                        onChange={(v) => changeStore('paused_message', v)}
                        disabled={saving}
                      />
                    )}
                    <ToggleRow
                      label="Store visible on search engines"
                      description="Allow Google and other search engines to index your store"
                      checked={store.is_indexable}
                      onChange={(v) => changeStore('is_indexable', v)}
                      disabled={saving}
                    />
                  </SubSection>
                </Card>

                <Card title="Checkout" subtitle="How customers complete their orders">
                  <ToggleRow
                    label="Allow guest checkout"
                    description="Customers can order without an account"
                    checked={checkout.allow_guest_checkout}
                    onChange={(v) => changeCheckout('allow_guest_checkout', v)}
                    disabled={saving}
                  />
                  <ToggleRow
                    label="Require phone number"
                    description="Collect phone number for M-Pesa STK Push and delivery"
                    checked={checkout.require_phone}
                    onChange={(v) => changeCheckout('require_phone', v)}
                    disabled={saving}
                  />
                  <ToggleRow
                    label="Auto-confirm orders"
                    description="Mark orders as confirmed immediately after payment"
                    checked={checkout.auto_confirm_orders}
                    onChange={(v) => changeCheckout('auto_confirm_orders', v)}
                    disabled={saving}
                  />
                  <ToggleRow
                    label="WhatsApp fallback"
                    description="Show 'Order on WhatsApp' button if checkout fails"
                    checked={checkout.whatsapp_fallback}
                    onChange={(v) => changeCheckout('whatsapp_fallback', v)}
                    disabled={saving}
                  />
                </Card>

                <Card title="Inventory" subtitle="Stock tracking and backorders">
                  <ToggleRow
                    label="Track inventory"
                    description="Decrease stock automatically on each sale"
                    checked={inventory.track_inventory}
                    onChange={(v) => changeInventory('track_inventory', v)}
                    disabled={saving}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                    <Field
                      label="Low stock threshold"
                      value={inventory.low_stock_threshold}
                      onChange={(v) => changeInventory('low_stock_threshold', v)}
                      type="number"
                      disabled={saving}
                    />
                  </div>
                  <ToggleRow
                    label="Allow backorders"
                    description="Accept orders when stock is zero"
                    checked={inventory.allow_backorders}
                    onChange={(v) => changeInventory('allow_backorders', v)}
                    disabled={saving}
                  />
                  <ToggleRow
                    label="Hide out-of-stock products"
                    description="Remove sold-out products from the storefront"
                    checked={inventory.hide_out_of_stock}
                    onChange={(v) => changeInventory('hide_out_of_stock', v)}
                    disabled={saving}
                  />
                </Card>

                <Card title="Reviews" subtitle="Customer product reviews and ratings">
                  <ToggleRow
                    label="Enable reviews"
                    description="Let customers leave ratings and comments"
                    checked={reviews.reviews_enabled}
                    onChange={(v) => changeReviews('reviews_enabled', v)}
                    disabled={saving}
                  />
                  <ToggleRow
                    label="Require verified purchase"
                    description="Only buyers can review a product"
                    checked={reviews.require_verified_purchase}
                    onChange={(v) => changeReviews('require_verified_purchase', v)}
                    disabled={saving}
                  />
                  <ToggleRow
                    label="Auto-publish reviews"
                    description="Show reviews immediately without moderation"
                    checked={reviews.auto_publish}
                    onChange={(v) => changeReviews('auto_publish', v)}
                    disabled={saving}
                  />
                  <ToggleRow
                    label="Allow photo uploads"
                    description="Customers can attach images to reviews"
                    checked={reviews.allow_photos}
                    onChange={(v) => changeReviews('allow_photos', v)}
                    disabled={saving}
                  />
                </Card>
              </>
            )} 
            {activeTab === 'payments' && (
              <>
                <Card
                  title="Payment gateway"
                  subtitle="M-Pesa Daraja is the only checkout method on this store"
                >
                 

                  <ToggleRow
                    label="M-Pesa (Safaricom Daraja)"
                    description="STK Push prompt sent to the customer's phone at checkout"
                    checked={payments.mpesa_enabled}
                    onChange={(v) => changePayments('mpesa_enabled', v)}
                    disabled={saving}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[13px]">
                    <div className="bg-slate-50 border border-slate-200 rounded p-2">
                      <p className="font-medium text-slate-700">Environment</p>
                      <p className="text-slate-500 mt-0.5 capitalize">
                        {mpesaStatus?.environment ?? '—'}
                      </p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded p-2">
                      <p className="font-medium text-slate-700">Shortcode</p>
                      <p className="text-slate-500 mt-0.5 font-mono">
                        {mpesaStatus?.shortcode || '—'}
                      </p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded p-2">
                      <p className="font-medium text-slate-700">Last rotated</p>
                      <p className="text-slate-500 mt-0.5">
                        {mpesaStatus?.last_rotated_at
                          ? new Date(mpesaStatus.last_rotated_at).toLocaleDateString('en-KE')
                          : '—'}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card title="Checkout method order" subtitle="Payment options shown at checkout">
                  <ul className="border border-slate-200 rounded divide-y divide-slate-100">
                    <li className="p-2 flex items-center justify-between gap-2 text-[13px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded bg-slate-100 text-slate-600 flex items-center justify-center font-mono text-[13px] shrink-0">
                          1
                        </span>
                        <span className="font-medium text-slate-900 truncate inline-flex items-center gap-2">
                          <Banknote className="w-4 h-4 text-emerald-600" />
                          M-Pesa
                        </span>
                      </div>
                      <span className="text-[13px] text-slate-400 shrink-0">
                        Only method enabled
                      </span>
                    </li>
                  </ul>
                  <p className="text-[13px] text-slate-500">
                    Additional gateways will appear here once your platform administrator connects
                    them.
                  </p>
                </Card>

                <Card
                  title="Transaction settings"
                  subtitle="Order amount limits and automatic actions"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
                    <Field
                      label="Minimum order (KES)"
                      value={payments.min_amount_kes}
                      onChange={(v) => changePayments('min_amount_kes', v)}
                      type="number"
                      disabled={saving}
                    />
                    <Field
                      label="Maximum order (KES)"
                      value={payments.max_amount_kes}
                      onChange={(v) => changePayments('max_amount_kes', v)}
                      type="number"
                      disabled={saving}
                    />
                    <Field
                      label="Transaction fee (KES)"
                      value={payments.transaction_fee_kes}
                      onChange={(v) => changePayments('transaction_fee_kes', v)}
                      type="number"
                      disabled={saving}
                    />
                  </div>
                  <ToggleRow
                    label="Auto-capture payments"
                    description="Capture authorized payments immediately"
                    checked={payments.auto_capture}
                    onChange={(v) => changePayments('auto_capture', v)}
                    disabled={saving}
                  />
                  <ToggleRow
                    label="Auto-refund on cancellation"
                    description="Refund the customer automatically when they cancel"
                    checked={payments.auto_refund}
                    onChange={(v) => changePayments('auto_refund', v)}
                    disabled={saving}
                  />
                </Card>
              </>
            )}
 
            {activeTab === 'shipping' && (
              <>
                <Card title="Shipping basics" subtitle="Enable delivery and set global defaults">
                  <ToggleRow
                    label="Enable shipping"
                    description="Offer delivery at checkout"
                    checked={shipping.shipping_enabled}
                    onChange={(v) => changeShipping('shipping_enabled', v)}
                    disabled={saving}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                    <Field
                      label="Free shipping above (KES)"
                      value={shipping.free_shipping_threshold_kes}
                      onChange={(v) => changeShipping('free_shipping_threshold_kes', v)}
                      type="number"
                      disabled={saving}
                    />
                    <Field
                      label="Default delivery fee (KES)"
                      value={shipping.default_delivery_fee_kes}
                      onChange={(v) => changeShipping('default_delivery_fee_kes', v)}
                      type="number"
                      disabled={saving}
                    />
                  </div>
                  <ToggleRow
                    label="Local pickup"
                    description="Let customers pick up in person"
                    checked={shipping.local_pickup_enabled}
                    onChange={(v) => changeShipping('local_pickup_enabled', v)}
                    disabled={saving}
                  />
                </Card>

                <Card
                  title="Delivery providers"
                  subtitle="Courier partners integrated with your store"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
                    {providers.map((p) => (
                      <ToggleRow
                        key={p.key}
                        label={p.name}
                        checked={p.enabled}
                        onChange={() => void toggleProvider(p.key)}
                        disabled={saving}
                      />
                    ))}
                  </div>
                </Card>

                <Card title="Delivery zones" subtitle="Region-by-region rates and ETAs">
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => openZoneModal()}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 disabled:opacity-60 text-white font-medium px-2.5 py-2 rounded text-[13px]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add zone
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded">
                    <table className="w-full text-left border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-2 font-medium">Zone</th>
                          <th className="py-2 px-2 font-medium">Region</th>
                          <th className="py-2 px-2 font-medium text-right">Fee (KES)</th>
                          <th className="py-2 px-2 font-medium">ETA</th>
                          <th className="py-2 px-2 font-medium">Status</th>
                          <th className="py-2 px-2 w-24"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {zones.length === 0 && (
                          <tr>
                            <td
                              colSpan={6}
                              className="py-3 px-2 text-center text-slate-400 italic"
                            >
                              No delivery zones yet.
                            </td>
                          </tr>
                        )}
                        {zones.map((z, idx) => (
                          <tr key={z.id ?? `new-${idx}`} className="hover:bg-slate-50">
                            <td className="py-2 px-2 font-medium text-slate-900">
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {z.name}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-slate-600">{z.region}</td>
                            <td className="py-2 px-2 text-right font-mono">{z.fee_kes}</td>
                            <td className="py-2 px-2 text-slate-600">{z.eta_text}</td>
                            <td className="py-2 px-2">
                              <button
                                onClick={() => void toggleZone(z.id)}
                                disabled={z.id === null || saving}
                                className={`inline-block px-2 py-0.5 rounded text-[13px] font-medium border disabled:opacity-60 ${
                                  z.enabled
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                              >
                                {z.enabled ? 'Active' : 'Disabled'}
                              </button>
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => openZoneModal(z)}
                                  disabled={saving}
                                  title="Edit"
                                  className="p-2 rounded bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-60"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setPendingZoneDelete(z)}
                                  disabled={z.id === null || saving}
                                  title="Remove"
                                  className="p-2 rounded bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
                                >
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
            {activeTab === 'notifications' && (
              <>
                <Card
                  title="Channels"
                  subtitle="Email delivery via SendGrid and messaging via WhatsApp Cloud API"
                >
                  <ToggleRow
                    label="Email notifications"
                    description="Send order and account updates via SendGrid"
                    checked={notifications.email_enabled}
                    onChange={(v) => changeNotifications('email_enabled', v)}
                    disabled={saving}
                  />
                  <ToggleRow
                    label="WhatsApp notifications"
                    description="Send templated messages through the WhatsApp Business Cloud API"
                    checked={notifications.whatsapp_enabled}
                    onChange={(v) => changeNotifications('whatsapp_enabled', v)}
                    disabled={saving}
                  />

                  <div className="bg-blue-50 border border-blue-200 rounded p-2 flex items-start gap-2">
                    <Mail className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
                    <p className="text-blue-800 text-[13px]">
                      This store sends notifications by email (SendGrid) and WhatsApp only.
                      SMS is not supported on this platform.
                    </p>
                  </div>
                </Card>

                <Card title="Events" subtitle="Pick which events trigger a notification">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
                    <ToggleRow
                      label="New order placed"
                      checked={notifications.notify_on_new_order}
                      onChange={(v) => changeNotifications('notify_on_new_order', v)}
                      disabled={saving}
                    />
                    <ToggleRow
                      label="Payment received"
                      checked={notifications.notify_on_payment}
                      onChange={(v) => changeNotifications('notify_on_payment', v)}
                      disabled={saving}
                    />
                    <ToggleRow
                      label="Order shipped"
                      checked={notifications.notify_on_shipped}
                      onChange={(v) => changeNotifications('notify_on_shipped', v)}
                      disabled={saving}
                    />
                    <ToggleRow
                      label="Order cancelled"
                      checked={notifications.notify_on_cancelled}
                      onChange={(v) => changeNotifications('notify_on_cancelled', v)}
                      disabled={saving}
                    />
                    <ToggleRow
                      label="Low stock alert"
                      checked={notifications.notify_on_low_stock}
                      onChange={(v) => changeNotifications('notify_on_low_stock', v)}
                      disabled={saving}
                    />
                    <ToggleRow
                      label="New review posted"
                      checked={notifications.notify_on_review}
                      onChange={(v) => changeNotifications('notify_on_review', v)}
                      disabled={saving}
                    />
                  </div>
                </Card>

                <Card title="Admin recipient" subtitle="Where internal alerts are sent">
                  <Field
                    label="Admin alert email"
                    value={notifications.admin_alert_email}
                    onChange={(v) => changeNotifications('admin_alert_email', v)}
                    type="email"
                    disabled={saving}
                  />
                  <div className="bg-blue-50 border border-blue-200 rounded p-2 flex items-start gap-2 mt-1">
                    <Lock className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
                    <p className="text-blue-800 text-[13px]">
                      SendGrid API key, WhatsApp Phone Number ID, WABA ID, and permanent access
                      token are configured by your platform administrator. Contact support to
                      update them.
                    </p>
                  </div>
                  {whatsappStatus?.template_map &&
                    Object.keys(whatsappStatus.template_map).length > 0 && (
                      <div className="bg-slate-50 border border-slate-200 rounded p-1 mt-1">
                        <p className="text-[12px] font-medium text-slate-700 mb-1">
                          Approved templates
                        </p>
                        <ul className="space-y-0.5">
                          {Object.entries(whatsappStatus.template_map).map(([event, tpl]) => (
                            <li
                              key={event}
                              className="text-[13px] text-slate-500 font-mono flex items-center justify-between"
                            >
                              <span>{event}</span>
                              <span className="text-slate-400">{tpl}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </Card>
              </>
            )} 
            {activeTab === 'security' && (
              <>
                <Card title="Password" subtitle="Change your admin account password">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
                    <PasswordField
                      label="Current password"
                      value={currentPassword}
                      onChange={setCurrentPassword}
                      disabled={changingPassword}
                    />
                    <PasswordField
                      label="New password"
                      value={newPassword}
                      onChange={setNewPassword}
                      hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
                      disabled={changingPassword}
                    />
                    <PasswordField
                      label="Confirm password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      disabled={changingPassword}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={changePassword}
                      disabled={
                        !currentPassword ||
                        !newPassword ||
                        newPassword !== confirmPassword ||
                        changingPassword
                      }
                      className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium px-3 py-2 rounded text-[13px]"
                    >
                      {changingPassword ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Lock className="w-3.5 h-3.5" />
                      )}
                      Update password
                    </button>
                  </div>
                </Card>

                <Card
                  title="Two-factor authentication"
                  subtitle="Add a second step when signing in"
                >
                  <ToggleRow
                    label="Require 2FA at login"
                    description="Recommended for admin accounts"
                    checked={security.require_2fa}
                    onChange={(v) => changeSecurity('require_2fa', v)}
                    disabled={saving}
                  />
                  {security.require_2fa && (
                    <>
                      <div className="p-2 rounded border border-blue-950 bg-blue-50/40 text-blue-950 text-[13px]">
                        <span className="text-[13px] font-medium inline-flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5" />
                          Authenticator app (TOTP)
                        </span>
                      </div>
                      <p className="text-[13px] text-slate-500">
                        Second factor is confirmed with a TOTP app. SMS codes are not supported on
                        this platform.
                      </p>
                    </>
                  )}
                </Card>

                <Card
                  title="Session management"
                  subtitle="Auto-logout and force-close other sessions"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                    <Field
                      label="Session timeout (minutes)"
                      value={security.session_timeout_minutes}
                      onChange={(v) => changeSecurity('session_timeout_minutes', v)}
                      type="number"
                      disabled={saving}
                    />
                  </div>

                  <SubSection title="Active sessions">
                    {sessionsLoading ? (
                      <div className="flex items-center gap-2 text-slate-500 py-3">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="text-[13px]">Loading sessions…</span>
                      </div>
                    ) : sessions.length === 0 ? (
                      <p className="text-[13px] text-slate-400 italic py-4">
                        No active sessions found.
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-100 border border-slate-200 rounded">
                        {sessions.map((s) => (
                          <li
                            key={s.id}
                            className="p-2 flex items-center justify-between gap-2 text-[13px]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 font-mono truncate text-[13px]">
                                  {s.id.slice(0, 12)}…
                                </p>
                                <p className="text-[13px] text-slate-400 font-mono truncate">
                                  expires {new Date(s.expires_at).toLocaleString('en-KE')}
                                </p>
                              </div>
                            </div>
                            {s.current ? (
                              <span className="inline-block px-2 py-0.5 rounded text-[13px] bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                                This device
                              </span>
                            ) : (
                              <button
                                onClick={() => void revokeSession(s.id)}
                                className="inline-flex items-center gap-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-medium px-2.5 py-1.5 rounded text-[13px] shrink-0"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                Revoke
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </SubSection>
                </Card>

                <Card
                  title="Login history"
                  subtitle="Recent authentication events on your account"
                >
                  {loginHistory.length === 0 ? (
                    <p className="text-[13px] text-slate-400 italic py-4">
                      No login events recorded yet.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100 border border-slate-200 rounded">
                      {loginHistory.map((l) => (
                        <li
                          key={l.id}
                          className="p-2 flex items-center justify-between gap-2 text-[13px]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <LogIn className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">
                                {l.device_label || 'Unknown device'}
                              </p>
                              <p className="text-[13px] text-slate-400 font-mono truncate">
                                {l.ip_address ?? '—'} · {l.location || '—'}
                              </p>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[13px] text-slate-400 font-mono shrink-0">
                            <Clock className="w-3 h-3" />
                            {new Date(l.created_at).toLocaleString('en-KE')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </>
            )} 
            {activeTab === 'integrations' && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded p-1 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <Info className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
                    <div className="text-[13px] flex-1 min-w-0">
                      <p className="font-medium text-blue-950">Read-only integration status</p>
                      <p className="text-blue-800 mt-0.5">
                        Connecting, disconnecting, and configuring integrations is handled by your
                        platform administrator. This view shows what&apos;s currently active.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => void refreshIntegrations()}
                    disabled={refreshingIntegrations}
                    className="inline-flex items-center gap-1.5 bg-white border border-blue-200 text-blue-950 hover:bg-blue-100 disabled:opacity-60 font-medium px-2.5 py-1.5 rounded text-[13px] shrink-0"
                  >
                    {refreshingIntegrations ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Refresh
                  </button>
                </div>

                <Card
                  title="Payment gateway"
                  subtitle="M-Pesa Daraja is the only payment method wired into this store"
                >
                  <IntegrationGrid items={paymentIntegrations} />
                </Card>

                <Card
                  title="Messaging"
                  subtitle="SendGrid handles email; WhatsApp Cloud API handles messaging. SMS is not supported."
                >
                  <IntegrationGrid items={messagingIntegrations} />
                </Card>

                <Card
                  title="Social app (TikTok only)"
                  subtitle="Your dedicated TikTok social shop — bio link, pixel, and LIVE selling"
                >
                  <div className="bg-amber-50 border border-amber-200 rounded p-2 flex items-start gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-[13px] text-amber-900 space-y-0.5">
                      <p className="font-medium">TikTok Shop is not available in Kenya.</p>
                      <p className="text-amber-800">
                        TikTok is used purely for discovery. Customers tap your bio link or
                        WhatsApp you to complete the order, and payment is collected via M-Pesa
                        Daraja on your storefront.
                      </p>
                    </div>
                  </div>
                  <IntegrationGrid items={socialAppIntegrations} onCopy={copyToClipboard} />
                </Card>

                <Card
                  title="Social media management"
                  subtitle="The social channels you promote on — they drive traffic back to the TikTok social app"
                >
                  <IntegrationGrid items={socialIntegrations} onCopy={copyToClipboard} />
                </Card>

                <Card title="Analytics" subtitle="Traffic and conversion tracking">
                  <IntegrationGrid items={analyticsIntegrations} />
                </Card>
              </>
            )} 
            {activeTab === 'tax' && (
              <Card title="Tax preferences" subtitle="VAT calculation and statutory invoicing">
                <SubSection title="VAT">
                  <ToggleRow
                    label="Enable VAT calculation"
                    description="Automatically add value-added tax to checkout orders"
                    checked={tax.vat_enabled}
                    onChange={(v) => changeTax('vat_enabled', v)}
                    disabled={saving}
                  />
                  {tax.vat_enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                      <Field
                        label="Default VAT rate (%)"
                        value={tax.vat_rate}
                        onChange={(v) => changeTax('vat_rate', v)}
                        type="number"
                        disabled={saving}
                      />
                      <div className="flex items-end pb-2">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={tax.prices_include_tax}
                            onChange={(e) => changeTax('prices_include_tax', e.target.checked)}
                            disabled={saving}
                            className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950"
                          />
                          <span className="font-medium text-slate-700">
                            Catalog prices include VAT
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </SubSection>

                <SubSection title="KRA eTIMS fiscal invoices">
                  <ToggleRow
                    label="Enable eTIMS on paid orders"
                    description="Auto-submit tax invoices to KRA eTIMS when M-Pesa payments succeed"
                    checked={tax.etims_enabled}
                    onChange={(v) => changeTax('etims_enabled', v)}
                    disabled={saving}
                  />
                  <div className="bg-blue-50 border border-blue-200 rounded p-1 flex items-start gap-1">
                    <Lock className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
                    <p className="text-blue-800 text-[13px]">
                      KRA PIN, control unit ID, and eTIMS API credentials are managed by your
                      platform administrator. Contact support to update them.
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
        <Modal
          onClose={() => {
            setShowUnsavedPrompt(false);
            setPendingTab(null);
          }}
        >
          <div className="text-center space-y-2">
            <div className="w-10 h-10 rounded bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Unsaved changes</h3>
              <p className="text-slate-500 mt-1 text-[13px]">
                You have modified settings on this tab. Discard your changes and switch?
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => {
                  setShowUnsavedPrompt(false);
                  setPendingTab(null);
                }}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded text-[13px]"
              >
                Keep editing
              </button>
              <button
                onClick={confirmTabSwitch}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded text-[13px]"
              >
                Discard &amp; switch
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ZONE MODAL */}
      {isZoneModalOpen && (
        <Modal onClose={() => setIsZoneModalOpen(false)}>
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-slate-900">
                {editingZone ? 'Edit delivery zone' : 'New delivery zone'}
              </h3>
              <button
                onClick={() => setIsZoneModalOpen(false)}
                className="h-8 w-8 rounded hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
              <Field
                label="Zone name"
                value={zoneDraft.name}
                onChange={(v) => setZoneDraft((d) => ({ ...d, name: v }))}
                disabled={saving}
              />
              <Field
                label="Region"
                value={zoneDraft.region}
                onChange={(v) => setZoneDraft((d) => ({ ...d, region: v }))}
                disabled={saving}
              />
              <Field
                label="Fee (KES)"
                value={zoneDraft.fee_kes}
                onChange={(v) => setZoneDraft((d) => ({ ...d, fee_kes: v }))}
                type="number"
                disabled={saving}
              />
              <Field
                label="ETA"
                value={zoneDraft.eta_text}
                onChange={(v) => setZoneDraft((d) => ({ ...d, eta_text: v }))}
                disabled={saving}
              />
            </div>
            <ToggleRow
              label="Zone active"
              description="Show this zone at checkout"
              checked={zoneDraft.enabled}
              onChange={(v) => setZoneDraft((d) => ({ ...d, enabled: v }))}
              disabled={saving}
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setIsZoneModalOpen(false)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={saveZone}
                disabled={saving || !zoneDraft.name.trim()}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 disabled:opacity-60 text-white font-medium px-3 py-2 rounded text-[13px]"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save zone
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ZONE DELETE CONFIRM */}
      {pendingZoneDelete && (
        <Modal onClose={() => setPendingZoneDelete(null)}>
          <div className="text-center space-y-2">
            <div className="w-10 h-10 rounded bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">
                Remove &ldquo;{pendingZoneDelete.name}&rdquo;?
              </h3>
              <p className="text-slate-500 mt-1 text-[13px]">
                Customers in this zone will no longer see the corresponding delivery rate at
                checkout.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => setPendingZoneDelete(null)}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteZone}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded text-[13px]"
              >
                Remove zone
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
} 
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
    <section className="bg-white border border-slate-200 rounded p-3 space-y-2">
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
    <div className="pt-3 mt-1 border-t border-slate-100 first:pt-0 first:mt-0 first:border-0 space-y-2">
      <p className="text-[13px] font-medium text-slate-700">{title}</p>
      {children}
    </div>
  );
}

function Modal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded max-w-md w-full p-2 shadow-xl text-[13px]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="block font-medium text-slate-700 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60 disabled:cursor-not-allowed"
      />
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  hint,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="block font-medium text-slate-700 mb-1">{label}</span>
      <input
        type="password"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60 disabled:cursor-not-allowed"
      />
      {hint && <span className="block text-[13px] text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="block font-medium text-slate-700 mb-1">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60 disabled:cursor-not-allowed"
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
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-2 border rounded p-2 bg-slate-50 border-slate-200 ${
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-900">{label}</p>
        {description && <p className="text-[13px] text-slate-500 mt-0.5">{description}</p>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950"
      />
    </label>
  );
}

function IntegrationGrid({
  items,
  onCopy,
}: {
  items: AdminIntegrationStatus[];
  onCopy?: (text: string, label: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-[13px] text-slate-400 italic">No integrations in this category.</p>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {items.map((item) => { 
        const SocialIcon = resolveSocialIcon(item);
        return (
          <div key={item.key} className="bg-white border border-slate-200 rounded p-2 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-sm bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                  {SocialIcon ? (
                    <SocialIcon className="w-4 h-4" aria-hidden />
                  ) : (
                    <span className="text-[13px] font-medium">
                      {item.name.charAt(0)}
                    </span>
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-900 truncate">{item.name}</p>
                  {item.badge && (
                    <button
                      type="button"
                      onClick={onCopy ? () => onCopy(item.badge, item.name) : undefined}
                      className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 font-mono truncate"
                      title={onCopy ? 'Copy' : undefined}
                    >
                      {item.badge}
                      {onCopy && <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[13px] font-medium border shrink-0 ${
                  item.connected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                {item.connected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                {item.connected ? 'Connected' : 'Not connected'}
              </span>
            </div>
            <p className="text-[13px] text-slate-500">{item.description}</p>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[13px] font-mono text-slate-400 uppercase">
                {item.category}
              </span>
              <span className="text-[13px] text-slate-400">Managed by admin</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}