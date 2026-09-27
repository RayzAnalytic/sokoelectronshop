'use client';

import React, { useEffect, useState } from 'react';
import {
  Save,
  Plus,
  CheckCircle2,
  X,
  Edit3,
  Trash2,
  Languages,
  DollarSign,
  MapPin,
  Calendar,
  Search,
} from 'lucide-react';

// --- TYPES ---
interface CurrencyItem {
  code: string;
  name: string;
  symbol: string;
  rate: number;
  enabled: boolean;
}

interface LanguageItem {
  code: string;
  name: string;
  completeness: number;
  isDefault: boolean;
}

interface CountyItem {
  id: string;
  name: string;
  code: string;
  zone: string;
}

interface TranslationRow {
  id: string;
  key: string;
  en: string;
  sw: string;
}

const ZONES = [
  'Zone A - Express (CBD & Suburbs)',
  'Zone B - Greater Nairobi',
  'Zone C - Coastal Region',
  'Zone D - Rift Valley',
  'Zone E - Western Kenya',
];

export default function LocalizationSettingsPage() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Currency
  const [defaultCurrency, setDefaultCurrency] = useState('KES');
  const [currencySymbol, setCurrencySymbol] = useState('KSh');
  const [symbolPosition, setSymbolPosition] = useState<'before' | 'after'>('before');
  const [decimalPlaces, setDecimalPlaces] = useState('2');
  const [thousandSeparator, setThousandSeparator] = useState(',');
  const [multiCurrencyEnabled, setMultiCurrencyEnabled] = useState(true);
  const [exchangeRateMode, setExchangeRateMode] = useState<'auto' | 'manual'>('auto');

  const [currencies, setCurrencies] = useState<CurrencyItem[]>([
    { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', rate: 1.0, enabled: true },
    { code: 'USD', name: 'US Dollar', symbol: '$', rate: 0.0077, enabled: true },
    { code: 'EUR', name: 'Euro', symbol: '€', rate: 0.0071, enabled: true },
    { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', rate: 20.15, enabled: false },
  ]);

  // Languages
  const [languages, setLanguages] = useState<LanguageItem[]>([
    { code: 'en', name: 'English', completeness: 100, isDefault: true },
    { code: 'sw', name: 'Swahili (Kiswahili)', completeness: 88, isDefault: false },
  ]);

  const [showTranslationModal, setShowTranslationModal] = useState(false);
  const [translationSearch, setTranslationSearch] = useState('');
  const [translations, setTranslations] = useState<TranslationRow[]>([
    { id: '1', key: 'cart.title', en: 'Shopping Cart', sw: 'Kikapu cha Manunuzi' },
    { id: '2', key: 'checkout.mpesa', en: 'Pay via M-Pesa STK Push', sw: 'Lipa kupitia M-Pesa STK Push' },
    { id: '3', key: 'product.add', en: 'Add to Cart', sw: 'Weka kwa Kikapu' },
    { id: '4', key: 'common.total', en: 'Total Amount', sw: 'Jumla ya Gharama' },
  ]);

  const [showAddLangModal, setShowAddLangModal] = useState(false);
  const [newLangName, setNewLangName] = useState('');
  const [newLangCode, setNewLangCode] = useState('');

  // Counties
  const [counties, setCounties] = useState<CountyItem[]>([
    { id: '1', name: 'Nairobi', code: '047', zone: 'Zone A - Express (CBD & Suburbs)' },
    { id: '2', name: 'Kiambu', code: '022', zone: 'Zone B - Greater Nairobi' },
    { id: '3', name: 'Mombasa', code: '001', zone: 'Zone C - Coastal Region' },
    { id: '4', name: 'Nakuru', code: '32', zone: 'Zone D - Rift Valley' },
    { id: '5', name: 'Kisumu', code: '042', zone: 'Zone E - Western Kenya' },
  ]);
  const [showCountyModal, setShowCountyModal] = useState(false);
  const [editingCounty, setEditingCounty] = useState<CountyItem | null>(null);
  const [countyNameInput, setCountyNameInput] = useState('');
  const [countyCodeInput, setCountyCodeInput] = useState('');
  const [countyZoneInput, setCountyZoneInput] = useState(ZONES[0]);

  // Formats
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [timeFormat, setTimeFormat] = useState('24h');
  const [numberFormat, setNumberFormat] = useState('1,234.56');

  const anyModalOpen =
    showTranslationModal || showAddLangModal || showCountyModal;

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (!anyModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCountyModal) setShowCountyModal(false);
        else if (showAddLangModal) setShowAddLangModal(false);
        else if (showTranslationModal) setShowTranslationModal(false);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [anyModalOpen, showCountyModal, showAddLangModal, showTranslationModal]);

  const toast = (msg: string) => setToastMessage(msg);

  const saveAll = () => toast('Localization settings saved');

  const toggleCurrencyEnabled = (code: string) => {
    setCurrencies((prev) =>
      prev.map((c) => (c.code === code ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleRateChange = (code: string, newRate: string) => {
    const val = parseFloat(newRate) || 0;
    setCurrencies((prev) => prev.map((c) => (c.code === code ? { ...c, rate: val } : c)));
  };

  const setDefaultLang = (code: string) => {
    setLanguages((prev) => prev.map((l) => ({ ...l, isDefault: l.code === code })));
    toast(`Default language updated to ${code.toUpperCase()}`);
  };

  const removeLang = (code: string) => {
    const lang = languages.find((l) => l.code === code);
    if (lang?.isDefault) {
      toast('Cannot remove default language');
      return;
    }
    setLanguages((prev) => prev.filter((l) => l.code !== code));
    toast('Language removed');
  };

  const addLanguageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLangName.trim() || !newLangCode.trim()) return;
    setLanguages((prev) => [
      ...prev,
      { code: newLangCode, name: newLangName, completeness: 10, isDefault: false },
    ]);
    setShowAddLangModal(false);
    setNewLangName('');
    setNewLangCode('');
    toast('Language added');
  };

  const openAddCounty = () => {
    setEditingCounty(null);
    setCountyNameInput('');
    setCountyCodeInput('');
    setCountyZoneInput(ZONES[0]);
    setShowCountyModal(true);
  };

  const openEditCounty = (item: CountyItem) => {
    setEditingCounty(item);
    setCountyNameInput(item.name);
    setCountyCodeInput(item.code);
    setCountyZoneInput(item.zone);
    setShowCountyModal(true);
  };

  const countySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!countyNameInput.trim()) return;
    if (editingCounty) {
      setCounties((prev) =>
        prev.map((c) =>
          c.id === editingCounty.id
            ? { ...c, name: countyNameInput, code: countyCodeInput, zone: countyZoneInput }
            : c
        )
      );
      toast('County updated');
    } else {
      setCounties((prev) => [
        ...prev,
        {
          id: `${Date.now()}`,
          name: countyNameInput,
          code: countyCodeInput || '00',
          zone: countyZoneInput,
        },
      ]);
      toast('County added');
    }
    setShowCountyModal(false);
  };

  const deleteCounty = (id: string) => {
    setCounties((prev) => prev.filter((c) => c.id !== id));
    toast('County deleted');
  };

  const filteredTranslations = translations.filter(
    (t) =>
      t.key.toLowerCase().includes(translationSearch.toLowerCase()) ||
      t.en.toLowerCase().includes(translationSearch.toLowerCase()) ||
      t.sw.toLowerCase().includes(translationSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[120] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
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
            <h1 className="text-[15px] font-semibold text-slate-900">Localization</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Currencies, translations, counties, and regional formats
            </p>
          </div>
          <button
            onClick={saveAll}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save changes</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* 1. CURRENCY */}
        <Section
          icon={<DollarSign className="w-4 h-4" />}
          tint="bg-blue-50 text-blue-950"
          title="Currency & exchange rates"
          subtitle="Default store currency and multi-currency configuration"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
            <SelectField
              label="Default currency"
              value={defaultCurrency}
              onChange={setDefaultCurrency}
              options={[
                { v: 'KES', l: 'KES - Kenyan Shilling' },
                { v: 'USD', l: 'USD - US Dollar' },
                { v: 'EUR', l: 'EUR - Euro' },
              ]}
            />
            <Field label="Currency symbol" value={currencySymbol} onChange={setCurrencySymbol} />
            <SelectField
              label="Symbol position"
              value={symbolPosition}
              onChange={(v) => setSymbolPosition(v as 'before' | 'after')}
              options={[
                { v: 'before', l: 'Before amount (KSh 1,500)' },
                { v: 'after', l: 'After amount (1,500 KSh)' },
              ]}
            />
            <SelectField
              label="Decimal places"
              value={decimalPlaces}
              onChange={setDecimalPlaces}
              options={[
                { v: '0', l: '0 (1,500)' },
                { v: '2', l: '2 (1,500.00)' },
              ]}
            />
            <SelectField
              label="Thousand separator"
              value={thousandSeparator}
              onChange={setThousandSeparator}
              options={[
                { v: ',', l: 'Comma (,)' },
                { v: '.', l: 'Dot (.)' },
                { v: ' ', l: 'Space ( )' },
              ]}
            />
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 border border-slate-200 p-2 rounded-sm">
              <div>
                <p className="text-[13px] font-medium text-slate-900">Multi-currency mode</p>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Let customers switch currencies on the storefront
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={exchangeRateMode}
                  onChange={(e) => setExchangeRateMode(e.target.value as 'auto' | 'manual')}
                  className="bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-blue-950"
                >
                  <option value="auto">Auto-sync rates (API)</option>
                  <option value="manual">Manual rates</option>
                </select>
                <input
                  type="checkbox"
                  checked={multiCurrencyEnabled}
                  onChange={(e) => setMultiCurrencyEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950"
                />
              </div>
            </div>

            {multiCurrencyEnabled && (
              <div className="border border-slate-200 rounded-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <th className="py-2 px-3 font-medium">Currency</th>
                        <th className="py-2 px-3 font-medium">Code</th>
                        <th className="py-2 px-3 font-medium">Symbol</th>
                        <th className="py-2 px-3 font-medium">Rate (vs KES)</th>
                        <th className="py-2 px-3 w-24"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currencies.map((c) => (
                        <tr key={c.code} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 font-medium text-slate-900">{c.name}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{c.code}</td>
                          <td className="py-2 px-3 text-slate-700">{c.symbol}</td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="0.0001"
                              value={c.rate}
                              disabled={exchangeRateMode === 'auto' || c.code === 'KES'}
                              onChange={(e) => handleRateChange(c.code, e.target.value)}
                              className="w-28 bg-white border border-slate-200 rounded-sm px-2 py-1 font-mono text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:bg-slate-50 disabled:text-slate-400"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => toggleCurrencyEnabled(c.code)}
                              disabled={c.code === 'KES'}
                              className={`px-2 py-0.5 rounded-sm text-[13px] font-medium border transition disabled:opacity-50 disabled:cursor-not-allowed ${
                                c.enabled
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              {c.enabled ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* 2. LANGUAGES */}
        <Section
          icon={<Languages className="w-4 h-4" />}
          tint="bg-purple-50 text-purple-700"
          title="Languages & translations"
          subtitle="Storefront languages and UI string translations"
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTranslationModal(true)}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Translation editor</span>
              </button>
              <button
                onClick={() => setShowAddLangModal(true)}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add language</span>
              </button>
            </div>
          }
        >
          <div className="border border-slate-200 rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2 px-3 font-medium">Language</th>
                    <th className="py-2 px-3 font-medium">Code</th>
                    <th className="py-2 px-3 font-medium">Completeness</th>
                    <th className="py-2 px-3 w-56"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {languages.map((lang) => (
                    <tr key={lang.code} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{lang.name}</span>
                          {lang.isDefault && (
                            <span className="bg-blue-50 text-blue-950 border border-blue-100 text-[13px] font-medium px-1.5 py-0.5 rounded-sm">
                              Default
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600">{lang.code}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2 max-w-xs">
                          <div className="flex-1 h-2 rounded-sm bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full ${
                                lang.completeness === 100 ? 'bg-emerald-500' : 'bg-blue-950'
                              }`}
                              style={{ width: `${lang.completeness}%` }}
                            />
                          </div>
                          <span className="text-[13px] font-medium text-slate-700 shrink-0">
                            {lang.completeness}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setShowTranslationModal(true)}
                            className="px-2 py-1 rounded-sm text-[13px] font-medium text-blue-950 hover:bg-blue-50 transition"
                          >
                            Edit
                          </button>
                          {!lang.isDefault && (
                            <>
                              <button
                                onClick={() => setDefaultLang(lang.code)}
                                className="px-2 py-1 rounded-sm text-[13px] font-medium text-slate-700 hover:bg-slate-100 transition"
                              >
                                Set default
                              </button>
                              <button
                                onClick={() => removeLang(lang.code)}
                                className="px-2 py-1 rounded-sm text-[13px] font-medium text-red-600 hover:bg-red-50 transition"
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* 3. COUNTIES */}
        <Section
          icon={<MapPin className="w-4 h-4" />}
          tint="bg-emerald-50 text-emerald-700"
          title="Counties & shipping zones"
          subtitle="Map Kenyan counties to shipping rate tiers"
          action={
            <button
              onClick={openAddCounty}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add county</span>
            </button>
          }
        >
          <div className="border border-slate-200 rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2 px-3 font-medium">County</th>
                    <th className="py-2 px-3 font-medium">Code</th>
                    <th className="py-2 px-3 font-medium">Shipping zone</th>
                    <th className="py-2 px-3 w-40"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {counties.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 font-medium text-slate-900">{c.name}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{c.code}</td>
                      <td className="py-2 px-3">
                        <span className="inline-block bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-sm text-[13px] font-medium">
                          {c.zone}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditCounty(c)}
                            className="px-2.5 py-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-[13px]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteCounty(c.id)}
                            className="px-2.5 py-2 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 font-medium text-[13px]"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* 4. FORMATS */}
        <Section
          icon={<Calendar className="w-4 h-4" />}
          tint="bg-amber-50 text-amber-700"
          title="Date, time & number formats"
          subtitle="Regional display conventions and address preview"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
            <SelectField
              label="Date format"
              value={dateFormat}
              onChange={setDateFormat}
              options={[
                { v: 'DD/MM/YYYY', l: 'DD/MM/YYYY (24/09/2026)' },
                { v: 'MM/DD/YYYY', l: 'MM/DD/YYYY (09/24/2026)' },
                { v: 'YYYY-MM-DD', l: 'YYYY-MM-DD (2026-09-24)' },
              ]}
            />
            <SelectField
              label="Time format"
              value={timeFormat}
              onChange={setTimeFormat}
              options={[
                { v: '24h', l: '24-hour (22:27)' },
                { v: '12h', l: '12-hour (10:27 PM)' },
              ]}
            />
            <SelectField
              label="Number format"
              value={numberFormat}
              onChange={setNumberFormat}
              options={[
                { v: '1,234.56', l: '1,234.56 (comma thousands)' },
                { v: '1.234,56', l: '1.234,56 (dot thousands)' },
              ]}
            />
          </div>

          <div className="pt-3 border-t border-slate-100">
            <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-2">
              <p className="text-[13px] font-medium text-slate-700 uppercase tracking-wide">
                Address format preview
              </p>
              <div className="bg-white border border-slate-200 rounded-sm p-2 text-slate-700 font-mono text-[13px] space-y-0.5">
                <p>Isaac Mutinda</p>
                <p>Westlands Commercial Centre, Ring Rd Westlands</p>
                <p>P.O. Box 45000 - 00100</p>
                <p>Nairobi, Kenya</p>
              </div>
            </div>
          </div>
        </Section>
      </main>

      {/* ─────── TRANSLATION EDITOR MODAL ─────── */}
      {showTranslationModal && (
        <div
          className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setShowTranslationModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm w-full max-w-4xl max-h-[85vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-slate-900">
                  Translation editor
                </h3>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Edit storefront keys for English and Swahili
                </p>
              </div>
              <button
                onClick={() => setShowTranslationModal(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-3 py-2 border-b border-slate-200 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400 ml-1" />
              <input
                type="text"
                placeholder="Search keys or phrases…"
                value={translationSearch}
                onChange={(e) => setTranslationSearch(e.target.value)}
                className="w-full bg-transparent text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none py-0.5"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <div className="border border-slate-200 rounded-sm overflow-hidden">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-3 font-medium w-1/4">Key</th>
                      <th className="py-2 px-3 font-medium">English</th>
                      <th className="py-2 px-3 font-medium">Swahili</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTranslations.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-mono text-slate-600">{item.key}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.en}
                            onChange={(e) =>
                              setTranslations((prev) =>
                                prev.map((t) =>
                                  t.id === item.id ? { ...t, en: e.target.value } : t
                                )
                              )
                            }
                            className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.sw}
                            onChange={(e) =>
                              setTranslations((prev) =>
                                prev.map((t) =>
                                  t.id === item.id ? { ...t, sw: e.target.value } : t
                                )
                              )
                            }
                            className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-3 py-2 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setShowTranslationModal(false)}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────── ADD LANGUAGE MODAL ─────── */}
      {showAddLangModal && (
        <div
          className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setShowAddLangModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-slate-900">Add language</h3>
              <button
                onClick={() => setShowAddLangModal(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={addLanguageSubmit} className="space-y-3 text-[13px]">
              <Field
                label="Language name"
                value={newLangName}
                onChange={setNewLangName}
                placeholder="e.g. French, Kikuyu"
              />
              <Field
                label="Language code (ISO 639-1)"
                value={newLangCode}
                onChange={setNewLangCode}
                placeholder="e.g. fr, ki"
                mono
              />
              <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddLangModal(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Add language
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────── COUNTY MODAL ─────── */}
      {showCountyModal && (
        <div
          className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setShowCountyModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-slate-900">
                {editingCounty ? 'Edit county' : 'Add county'}
              </h3>
              <button
                onClick={() => setShowCountyModal(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={countySubmit} className="space-y-3 text-[13px]">
              <Field
                label="County name"
                value={countyNameInput}
                onChange={setCountyNameInput}
                placeholder="e.g. Uasin Gishu"
              />
              <Field
                label="County code"
                value={countyCodeInput}
                onChange={setCountyCodeInput}
                placeholder="e.g. 027"
                mono
              />
              <SelectField
                label="Shipping zone"
                value={countyZoneInput}
                onChange={setCountyZoneInput}
                options={ZONES.map((z) => ({ v: z, l: z }))}
              />
              <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCountyModal(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  {editingCounty ? 'Update county' : 'Save county'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── Reusable: Section ───────── */
function Section({
  icon,
  tint,
  title,
  subtitle,
  action,
  children,
}: {
  icon: React.ReactNode;
  tint: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${tint}`}>
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-slate-900 truncate">{title}</p>
            {subtitle && <p className="text-[13px] text-slate-500 truncate">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children}
    </section>
  );
}

/* ───────── Reusable: Field ───────── */
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
        placeholder={placeholder}
        className={`w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 ${
          mono ? 'font-mono' : ''
        }`}
      />
    </label>
  );
}

/* ───────── Reusable: SelectField ───────── */
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