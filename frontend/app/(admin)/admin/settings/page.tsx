'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Save,
  Building,
  Receipt,
  Mail,
  Globe,
  ShieldAlert,
  Plug,
  Eye,
  EyeOff,
  Send,
  X,
  AlertTriangle,
} from 'lucide-react';

type SettingsTab = 'general' | 'tax' | 'email' | 'seo' | 'maintenance' | 'integrations';

interface IntegrationCard {
  id: string;
  name: string;
  category: string;
  connected: boolean;
  description: string;
}

const TABS: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'general', label: 'General info', icon: Building },
  { id: 'tax', label: 'Tax & eTIMS', icon: Receipt },
  { id: 'email', label: 'Email SMTP', icon: Mail },
  { id: 'seo', label: 'SEO & tracking', icon: Globe },
  { id: 'maintenance', label: 'Maintenance', icon: ShieldAlert },
  { id: 'integrations', label: 'Integrations', icon: Plug },
];

export default function StoreSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const [pendingTab, setPendingTab] = useState<SettingsTab | null>(null);

  // GENERAL
  const [storeName, setStoreName] = useState('SokoFlow Commerce');
  const [tagline, setTagline] = useState('Conversational commerce for WhatsApp & M-Pesa');
  const [contactEmail, setContactEmail] = useState('admin@sokoflow.co.ke');
  const [phone, setPhone] = useState('+254 712 345 678');
  const [address, setAddress] = useState('Westlands Commercial Centre, Nairobi, Kenya');
  const [currency, setCurrency] = useState('KES');
  const [timezone, setTimezone] = useState('Africa/Nairobi');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [weightUnit, setWeightUnit] = useState('kg');

  // TAX
  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRate, setVatRate] = useState('16');
  const [pricesIncludeTax, setPricesIncludeTax] = useState(true);
  const [etimsPin, setEtimsPin] = useState('P051234567Z');
  const [etimsDeviceId, setEtimsDeviceId] = useState('ETIMS-NBI-0042');
  const [etimsApiKey, setEtimsApiKey] = useState('sk_live_9988223344556677');
  const [showApiKey, setShowApiKey] = useState(false);

  // EMAIL
  const [smtpHost, setSmtpHost] = useState('smtp.mailgun.org');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('postmaster@sokoflow.co.ke');
  const [smtpPass, setSmtpPass] = useState('secretpassword');
  const [smtpEncryption, setSmtpEncryption] = useState('TLS');
  const [fromName, setFromName] = useState('SokoFlow Notifications');
  const [fromEmail, setFromEmail] = useState('orders@sokoflow.co.ke');

  // SEO
  const [metaTitle, setMetaTitle] = useState('SokoFlow | WhatsApp & M-Pesa Storefronts');
  const [metaDescription, setMetaDescription] = useState(
    'Automate customer orders, M-Pesa STK push payments, and WhatsApp conversational commerce in Kenya.'
  );
  const [metaKeywords, setMetaKeywords] = useState('sokoflow, mpesa, whatsapp, kenya ecommerce, daraja');
  const [gaId, setGaId] = useState('G-ABC123XYZ');
  const [fbPixelId, setFbPixelId] = useState('1122334455667788');
  const [robotsTxt, setRobotsTxt] = useState('User-agent: *\nDisallow: /checkout/\nDisallow: /admin/');
  const [sitemapEnabled, setSitemapEnabled] = useState(true);

  // MAINTENANCE
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState(
    'We are currently updating our M-Pesa payment gateways. We will be back online shortly!'
  );
  const [allowedIps, setAllowedIps] = useState('197.232.0.1, 105.162.0.44');

  // INTEGRATIONS
  const [integrations, setIntegrations] = useState<IntegrationCard[]>([
    { id: 'whatsapp', name: 'WhatsApp Cloud API', category: 'Messaging', connected: true, description: 'Official Meta WhatsApp Business API for order notifications and cart reminders.' },
    { id: 'mpesa', name: 'Safaricom M-Pesa Daraja', category: 'Payments', connected: true, description: 'STK Push and C2B Paybill automated instant settlement.' },
    { id: 'airtel', name: 'Airtel Money API', category: 'Payments', connected: false, description: 'Airtel Money mobile wallet checkout integration.' },
    { id: 'stripe', name: 'Stripe International', category: 'Payments', connected: false, description: 'Global Visa, Mastercard, and Apple Pay processing.' },
    { id: 'ga', name: 'Google Analytics 4', category: 'Analytics', connected: true, description: 'Advanced visitor behavioral tracking and conversion funnels.' },
    { id: 'meta', name: 'Meta Pixel', category: 'Analytics', connected: true, description: 'Facebook & Instagram ad conversion attribution.' },
    { id: 'tiktok', name: 'TikTok Pixel', category: 'Analytics', connected: false, description: 'TikTok ad campaign conversion tracking.' },
  ]);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (!showUnsavedPrompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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
  }, [showUnsavedPrompt]);

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

  const testEtims = () => toast('Connected to KRA eTIMS');
  const testEmail = () => toast(`Test email sent to ${contactEmail}`);

  const toggleIntegration = (id: string) => {
    setIntegrations((prev) =>
      prev.map((it) => (it.id === id ? { ...it, connected: !it.connected } : it))
    );
    setHasUnsavedChanges(true);
    toast('Integration updated');
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
              Identity, taxation, gateways, and APIs
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
                      isActive
                        ? 'bg-blue-950 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
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

            {/* GENERAL */}
            {activeTab === 'general' && (
              <Card title="General store information" subtitle="Basic identification and regional formatting">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                  <Field label="Store name" value={storeName} onChange={(v) => change(setStoreName, v)} />
                  <Field label="Tagline" value={tagline} onChange={(v) => change(setTagline, v)} />
                  <Field label="Contact email" value={contactEmail} onChange={(v) => change(setContactEmail, v)} type="email" />
                  <Field label="Phone number" value={phone} onChange={(v) => change(setPhone, v)} />
                  <div className="sm:col-span-2">
                    <Field label="Physical address" value={address} onChange={(v) => change(setAddress, v)} />
                  </div>

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
              </Card>
            )}

            {/* TAX */}
            {activeTab === 'tax' && (
              <Card title="Tax & KRA eTIMS" subtitle="Kenyan VAT rules and electronic tax invoicing">
                <div className="space-y-3 text-[13px]">
                  <ToggleRow
                    label="Enable VAT calculation"
                    description="Automatically add value-added tax to checkout orders"
                    checked={vatEnabled}
                    onChange={(v) => change(setVatEnabled, v)}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field
                      label="Default VAT rate (%)"
                      value={vatRate}
                      onChange={(v) => change(setVatRate, v)}
                      type="number"
                    />
                    <div className="flex items-end pb-2">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pricesIncludeTax}
                          onChange={(e) => change(setPricesIncludeTax, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950"
                        />
                        <span className="font-medium text-slate-700">
                          Catalog prices include VAT
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <p className="text-[13px] font-medium text-slate-900">
                      KRA eTIMS fiscal device gateway
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Field
                        label="KRA PIN"
                        value={etimsPin}
                        onChange={(v) => change(setEtimsPin, v)}
                        mono
                      />
                      <Field
                        label="Control unit device ID"
                        value={etimsDeviceId}
                        onChange={(v) => change(setEtimsDeviceId, v)}
                        mono
                      />
                      <SecretField
                        label="eTIMS API secret"
                        value={etimsApiKey}
                        onChange={(v) => change(setEtimsApiKey, v)}
                        show={showApiKey}
                        onToggle={() => setShowApiKey(!showApiKey)}
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={testEtims}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                      >
                        Test eTIMS connection
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* EMAIL */}
            {activeTab === 'email' && (
              <Card title="Email SMTP gateway" subtitle="Outgoing transactional receipts and notifications">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                  <Field label="SMTP host" value={smtpHost} onChange={(v) => change(setSmtpHost, v)} mono />
                  <Field label="Port" value={smtpPort} onChange={(v) => change(setSmtpPort, v)} mono />
                  <Field label="SMTP username" value={smtpUser} onChange={(v) => change(setSmtpUser, v)} mono />
                  <SecretField
                    label="SMTP password"
                    value={smtpPass}
                    onChange={(v) => change(setSmtpPass, v)}
                    show={false}
                    onToggle={() => {}}
                  />
                  <SelectField
                    label="Encryption"
                    value={smtpEncryption}
                    onChange={(v) => change(setSmtpEncryption, v)}
                    options={[
                      { v: 'TLS', l: 'TLS' },
                      { v: 'SSL', l: 'SSL' },
                      { v: 'None', l: 'None' },
                    ]}
                  />
                  <Field label="Sender name" value={fromName} onChange={(v) => change(setFromName, v)} />
                  <div className="sm:col-span-2">
                    <Field label="Sender email" value={fromEmail} onChange={(v) => change(setFromEmail, v)} mono />
                  </div>
                </div>

                <div className="flex justify-end pt-3 mt-3 border-t border-slate-100">
                  <button
                    onClick={testEmail}
                    className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send test email
                  </button>
                </div>
              </Card>
            )}

            {/* SEO */}
            {activeTab === 'seo' && (
              <Card title="SEO & conversion tracking" subtitle="Search engine meta tags and tracking pixels">
                <div className="space-y-3 text-[13px]">
                  <Field label="Meta title" value={metaTitle} onChange={(v) => change(setMetaTitle, v)} />
                  <TextareaField
                    label="Meta description"
                    value={metaDescription}
                    onChange={(v) => change(setMetaDescription, v)}
                    rows={2}
                  />
                  <Field label="Keywords" value={metaKeywords} onChange={(v) => change(setMetaKeywords, v)} />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Google Analytics ID" value={gaId} onChange={(v) => change(setGaId, v)} mono />
                    <Field label="Facebook Pixel ID" value={fbPixelId} onChange={(v) => change(setFbPixelId, v)} mono />
                  </div>

                  <TextareaField
                    label="Robots.txt content"
                    value={robotsTxt}
                    onChange={(v) => change(setRobotsTxt, v)}
                    rows={3}
                    mono
                  />

                  <ToggleRow
                    label="Auto-generate XML sitemap"
                    description="Automatically publish sitemap.xml for search indexing"
                    checked={sitemapEnabled}
                    onChange={(v) => change(setSitemapEnabled, v)}
                  />
                </div>
              </Card>
            )}

            {/* MAINTENANCE */}
            {activeTab === 'maintenance' && (
              <Card title="Store maintenance mode" subtitle="Temporarily close public access during upgrades">
                <div className="space-y-3 text-[13px]">
                  <ToggleRow
                    label="Enable maintenance mode"
                    description="Visitors will see a custom maintenance notice"
                    checked={maintenanceMode}
                    onChange={(v) => change(setMaintenanceMode, v)}
                    danger={maintenanceMode}
                  />
                  <TextareaField
                    label="Custom maintenance message"
                    value={maintenanceMsg}
                    onChange={(v) => change(setMaintenanceMsg, v)}
                    rows={3}
                  />
                  <Field
                    label="Allowed IP whitelist (comma separated)"
                    value={allowedIps}
                    onChange={(v) => change(setAllowedIps, v)}
                    mono
                  />
                </div>
              </Card>
            )}

            {/* INTEGRATIONS */}
            {activeTab === 'integrations' && (
              <Card title="Third-party integrations" subtitle="Connect messaging, payment rails, and analytics">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {integrations.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-8 h-8 rounded-sm bg-slate-100 border border-slate-200 flex items-center justify-center text-[13px] font-medium text-slate-700 shrink-0">
                              {item.name.charAt(0)}
                            </span>
                            <p className="text-[13px] font-medium text-slate-900 truncate">
                              {item.name}
                            </p>
                          </div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-sm text-[13px] font-medium border shrink-0 ${
                              item.connected
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {item.connected ? 'Connected' : 'Disconnected'}
                          </span>
                        </div>
                        <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <span className="text-[13px] font-mono text-slate-400 uppercase tracking-wide">
                          {item.category}
                        </span>
                        <button
                          onClick={() => toggleIntegration(item.id)}
                          className={`px-2.5 py-2 rounded-sm font-medium text-[13px] transition border ${
                            item.connected
                              ? 'bg-white border-red-200 text-red-600 hover:bg-red-50'
                              : 'bg-blue-950 border-blue-950 text-white hover:bg-blue-900'
                          }`}
                        >
                          {item.connected ? 'Disconnect' : 'Connect'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
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
    </div>
  );
}

/* ---------- Reusable: Card ---------- */
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

/* ---------- Reusable: Field ---------- */
function Field({
  label,
  value,
  onChange,
  type = 'text',
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="block font-medium text-slate-700 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 ${
          mono ? 'font-mono' : ''
        }`}
      />
    </label>
  );
}

/* ---------- Reusable: SecretField ---------- */
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

/* ---------- Reusable: SelectField ---------- */
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

/* ---------- Reusable: TextareaField ---------- */
function TextareaField({
  label,
  value,
  onChange,
  rows = 3,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="block font-medium text-slate-700 mb-1">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950 ${
          mono ? 'font-mono' : ''
        }`}
      />
    </label>
  );
}

/* ---------- Reusable: ToggleRow ---------- */
function ToggleRow({
  label,
  description,
  checked,
  onChange,
  danger,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-3 border rounded-sm p-2 cursor-pointer ${
        danger ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-200'
      }`}
    >
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-900">{label}</p>
        {description && <p className="text-[13px] text-slate-500 mt-0.5">{description}</p>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`h-4 w-4 rounded border-slate-300 focus:ring-blue-950 ${
          danger ? 'text-red-600' : 'text-blue-950'
        }`}
      />
    </label>
  );
}
