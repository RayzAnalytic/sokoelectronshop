'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Palette,
  Layout,
  Type,
  Code2,
  Image as ImageIcon,
  Save,
  RotateCcw,
  CheckCircle2,
  X,
  Upload,
  GripVertical,
  Eye,
  Smartphone,
  Monitor,
  Sparkles,
  AlertCircle,
  Check,
} from 'lucide-react';

// --- TYPES ---
type AppearanceTab = 'theme' | 'branding' | 'layout' | 'typography' | 'css';

interface ColorPalette {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

interface HomepageSection {
  id: string;
  name: string;
  enabled: boolean;
}

const PRESET_PALETTES: ColorPalette[] = [
  { name: 'SokoFlow Dark Blue', primary: '#172554', secondary: '#0284c7', accent: '#f59e0b', background: '#f8fafc', text: '#0f172a' },
  { name: 'Emerald Commerce', primary: '#065f46', secondary: '#10b981', accent: '#f43f5e', background: '#f9fafb', text: '#111827' },
  { name: 'Sunset Orange', primary: '#9a3412', secondary: '#ea580c', accent: '#0284c7', background: '#fffaf5', text: '#292524' },
  { name: 'Royal Purple', primary: '#581c87', secondary: '#9333ea', accent: '#ec4899', background: '#faf5ff', text: '#3b0764' },
];

const HEADING_FONTS = ['Inter', 'Poppins', 'Plus Jakarta Sans', 'Playfair Display'];
const BODY_FONTS = ['Inter', 'Roboto', 'Open Sans', 'Plus Jakarta Sans'];

const TABS: { id: AppearanceTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'theme', label: 'Theme & colors', icon: Palette },
  { id: 'branding', label: 'Logo & branding', icon: ImageIcon },
  { id: 'layout', label: 'Layout builder', icon: Layout },
  { id: 'typography', label: 'Typography', icon: Type },
  { id: 'css', label: 'Custom CSS', icon: Code2 },
];

export default function AppearanceThemePage() {
  const [activeTab, setActiveTab] = useState<AppearanceTab>('theme');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  // Theme colours
  const [primaryColor, setPrimaryColor] = useState('#172554');
  const [secondaryColor, setSecondaryColor] = useState('#0284c7');
  const [accentColor, setAccentColor] = useState('#f59e0b');
  const [bgColor, setBgColor] = useState('#f8fafc');
  const [textColor, setTextColor] = useState('#0f172a');

  // Branding
  const [brandName, setBrandName] = useState('SokoFlow');
  const [tagline, setTagline] = useState('Conversational Commerce for WhatsApp & M-Pesa');
  const [lightLogo, setLightLogo] = useState('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80');
  const [darkLogo, setDarkLogo] = useState('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80');
  const [favicon, setFavicon] = useState('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=64&q=80');

  // Layout sections
  const [sections, setSections] = useState<HomepageSection[]>([
    { id: 'hero', name: 'Hero banner', enabled: true },
    { id: 'categories', name: 'Categories grid', enabled: true },
    { id: 'deals', name: 'Flash deals & discounts', enabled: true },
    { id: 'new-arrivals', name: 'New arrivals', enabled: true },
    { id: 'best-sellers', name: 'Best sellers', enabled: true },
    { id: 'newsletter', name: 'Newsletter signup', enabled: false },
  ]);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  // Typography
  const [headingFont, setHeadingFont] = useState('Inter');
  const [bodyFont, setBodyFont] = useState('Inter');
  const [baseFontSize, setBaseFontSize] = useState('16');
  const [lineHeight, setLineHeight] = useState('1.5');

  // Custom CSS
  const [customCss, setCustomCss] = useState(
    `/* Custom storefront CSS */\n.store-container {\n  border-radius: 16px;\n  box-shadow: 0 4px 20px rgba(0,0,0,0.05);\n}\n\n.btn-whatsapp {\n  background-color: #25D366 !important;\n  color: #ffffff !important;\n}`
  );

  const lightLogoRef = useRef<HTMLInputElement | null>(null);
  const darkLogoRef = useRef<HTMLInputElement | null>(null);
  const faviconRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (!isResetDialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsResetDialogOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [isResetDialogOpen]);

  const toast = (msg: string) => setToastMessage(msg);

  const applyPalette = (palette: ColorPalette) => {
    setPrimaryColor(palette.primary);
    setSecondaryColor(palette.secondary);
    setAccentColor(palette.accent);
    setBgColor(palette.background);
    setTextColor(palette.text);
    toast(`Applied ${palette.name}`);
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void,
    label: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setter(URL.createObjectURL(file));
    toast(`${label} uploaded`);
    if (e.target) e.target.value = '';
  };

  const handleDragStart = (index: number) => setDraggedItemIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    const updated = [...sections];
    const [moved] = updated.splice(draggedItemIndex, 1);
    updated.splice(index, 0, moved);
    setDraggedItemIndex(index);
    setSections(updated);
  };
  const handleDragEnd = () => setDraggedItemIndex(null);

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((sec) => (sec.id === id ? { ...sec, enabled: !sec.enabled } : sec))
    );
  };

  const saveAll = () => toast('Appearance settings saved and deployed');

  const resetDefaults = () => {
    setPrimaryColor('#172554');
    setSecondaryColor('#0284c7');
    setAccentColor('#f59e0b');
    setBgColor('#f8fafc');
    setTextColor('#0f172a');
    setBrandName('SokoFlow');
    setTagline('Conversational Commerce for WhatsApp & M-Pesa');
    setHeadingFont('Inter');
    setBodyFont('Inter');
    setBaseFontSize('16');
    setLineHeight('1.5');
    setIsResetDialogOpen(false);
    toast('Reset to defaults');
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
            <h1 className="text-[15px] font-semibold text-slate-900">Appearance & theme</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Storefront colours, branding, layout, typography, and custom CSS
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsResetDialogOpen(true)}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
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

      {/* TABS */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-3 flex gap-0.5 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? 'border-blue-950 text-blue-950'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-950' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-3 py-3 grid grid-cols-1 lg:grid-cols-12 gap-3">

        {/* LEFT — config pane */}
        <div className="lg:col-span-7 space-y-3">

          {/* THEME */}
          {activeTab === 'theme' && (
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
              <div>
                <p className="text-[13px] font-medium text-slate-900">Preset palettes</p>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Click any preset to apply instant colour harmony
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESET_PALETTES.map((pal, idx) => (
                  <button
                    key={idx}
                    onClick={() => applyPalette(pal)}
                    className="p-2 bg-white border border-slate-200 hover:border-blue-950 hover:bg-blue-50/20 rounded-sm text-left transition group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-slate-900">{pal.name}</span>
                      <Check className="w-3.5 h-3.5 text-blue-950 opacity-0 group-hover:opacity-100 transition" />
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <ColorDot color={pal.primary} title="Primary" />
                      <ColorDot color={pal.secondary} title="Secondary" />
                      <ColorDot color={pal.accent} title="Accent" />
                      <ColorDot color={pal.background} title="Background" />
                      <ColorDot color={pal.text} title="Text" />
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-[13px] font-medium text-slate-900 mb-2">
                  Custom colour pickers
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <ColorField label="Primary colour" value={primaryColor} onChange={setPrimaryColor} />
                  <ColorField label="Secondary colour" value={secondaryColor} onChange={setSecondaryColor} />
                  <ColorField label="Accent / CTA colour" value={accentColor} onChange={setAccentColor} />
                  <ColorField label="Background colour" value={bgColor} onChange={setBgColor} />
                  <ColorField label="Text colour" value={textColor} onChange={setTextColor} />
                </div>
              </div>
            </div>
          )}

          {/* BRANDING */}
          {activeTab === 'branding' && (
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
              <div>
                <p className="text-[13px] font-medium text-slate-900">Brand identity</p>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Store name, tagline, and logos for light/dark mode
                </p>
              </div>

              <div className="space-y-2 text-[13px]">
                <label className="block">
                  <span className="block font-medium text-slate-700 mb-1">Store name</span>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                </label>
                <label className="block">
                  <span className="block font-medium text-slate-700 mb-1">Tagline</span>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                </label>
              </div>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <LogoSlot
                  label="Light mode logo"
                  image={lightLogo}
                  dark
                  uploadRef={lightLogoRef}
                  onChange={(e) => handleFileUpload(e, setLightLogo, 'Light logo')}
                />
                <LogoSlot
                  label="Dark mode logo"
                  image={darkLogo}
                  uploadRef={darkLogoRef}
                  onChange={(e) => handleFileUpload(e, setDarkLogo, 'Dark logo')}
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-[13px] font-medium text-slate-700 mb-1">
                  Browser favicon
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-sm bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                    <img src={favicon} alt="" className="w-7 h-7 object-cover rounded-sm" />
                  </div>
                  <button
                    onClick={() => faviconRef.current?.click()}
                    className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-950" />
                    Upload favicon
                  </button>
                  <input
                    type="file"
                    ref={faviconRef}
                    onChange={(e) => handleFileUpload(e, setFavicon, 'Favicon')}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* LAYOUT */}
          {activeTab === 'layout' && (
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
              <div>
                <p className="text-[13px] font-medium text-slate-900">Homepage section order</p>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Drag to reorder or toggle individual sections
                </p>
              </div>

              <ul className="space-y-1.5">
                {sections.map((sec, index) => (
                  <li
                    key={sec.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`p-2 border rounded-sm flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing transition ${
                      sec.enabled
                        ? 'bg-white border-slate-200'
                        : 'bg-slate-50 border-dashed border-slate-300 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-[13px] font-medium text-slate-800 truncate">
                        {sec.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[13px] font-medium px-1.5 py-0.5 rounded-sm ${
                          sec.enabled
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {sec.enabled ? 'Visible' : 'Hidden'}
                      </span>
                      <button
                        onClick={() => toggleSection(sec.id)}
                        className={`px-2.5 py-1.5 rounded-sm text-[13px] font-medium transition border ${
                          sec.enabled
                            ? 'bg-white border-red-200 text-red-600 hover:bg-red-50'
                            : 'bg-blue-950 border-blue-950 text-white hover:bg-blue-900'
                        }`}
                      >
                        {sec.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* TYPOGRAPHY */}
          {activeTab === 'typography' && (
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
              <div>
                <p className="text-[13px] font-medium text-slate-900">Typography</p>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Font families and scale for your storefront
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
                <label className="block">
                  <span className="block font-medium text-slate-700 mb-1">Headings font</span>
                  <select
                    value={headingFont}
                    onChange={(e) => setHeadingFont(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  >
                    {HEADING_FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block font-medium text-slate-700 mb-1">Body font</span>
                  <select
                    value={bodyFont}
                    onChange={(e) => setBodyFont(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  >
                    {BODY_FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100 text-[13px]">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-700">Base font size</span>
                    <span className="font-mono text-blue-950">{baseFontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="14"
                    max="18"
                    step="1"
                    value={baseFontSize}
                    onChange={(e) => setBaseFontSize(e.target.value)}
                    className="w-full accent-blue-950"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-700">Line height ratio</span>
                    <span className="font-mono text-blue-950">{lineHeight}</span>
                  </div>
                  <input
                    type="range"
                    min="1.3"
                    max="1.8"
                    step="0.1"
                    value={lineHeight}
                    onChange={(e) => setLineHeight(e.target.value)}
                    className="w-full accent-blue-950"
                  />
                </div>
              </div>
            </div>
          )}

          {/* CUSTOM CSS */}
          {activeTab === 'css' && (
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-slate-900">Custom CSS</p>
                  <p className="text-[13px] text-slate-500 mt-0.5">
                    Injected directly into the storefront header
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 font-mono text-[13px] font-medium">
                  CSS 3.0
                </span>
              </div>

              <div className="border border-slate-200 rounded-sm overflow-hidden bg-slate-900 p-2">
                <textarea
                  rows={14}
                  value={customCss}
                  onChange={(e) => setCustomCss(e.target.value)}
                  className="w-full bg-transparent text-emerald-400 font-mono focus:outline-none resize-none leading-relaxed text-[13px]"
                  spellCheck={false}
                />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — live preview */}
        <div className="lg:col-span-5">
          <div className="sticky top-20 bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-blue-950" />
                <span className="text-[13px] font-medium text-slate-900">Live preview</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <Smartphone className="w-3.5 h-3.5 cursor-pointer hover:text-slate-800" />
                <Monitor className="w-3.5 h-3.5 text-blue-950" />
              </div>
            </div>

            {/* Mock storefront */}
            <div
              className="border border-slate-200 rounded-sm overflow-hidden"
              style={{ backgroundColor: bgColor, color: textColor, fontFamily: bodyFont }}
            >
              {/* Header */}
              <div
                className="p-2 flex items-center justify-between"
                style={{ backgroundColor: primaryColor, color: '#ffffff' }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <img
                    src={lightLogo}
                    alt=""
                    className="w-5 h-5 rounded-sm object-cover bg-white shrink-0"
                  />
                  <span className="text-[13px] font-semibold truncate">{brandName}</span>
                </div>
                <span className="text-[13px] opacity-80 font-mono shrink-0">
                  WhatsApp · M-Pesa
                </span>
              </div>

              {/* Hero */}
              <div className="p-3 text-center space-y-2 bg-black/5">
                <p
                  className="text-[13px] font-semibold tracking-tight"
                  style={{ fontFamily: headingFont }}
                >
                  {tagline}
                </p>
                <p className="text-[13px] opacity-75 max-w-xs mx-auto">
                  Instant STK Push checkout directly over WhatsApp
                </p>
                <button
                  className="px-3 py-1.5 rounded-sm text-[13px] font-medium shadow-sm"
                  style={{ backgroundColor: accentColor, color: '#ffffff' }}
                >
                  Order via WhatsApp
                </button>
              </div>

              {/* Sections */}
              <div className="p-2 space-y-1.5 bg-white/50">
                <p className="text-[13px] font-medium text-slate-500 mb-1">
                  Active homepage blocks
                </p>
                {sections.filter((s) => s.enabled).length === 0 ? (
                  <p className="text-[13px] text-slate-400 italic">No sections enabled</p>
                ) : (
                  sections
                    .filter((s) => s.enabled)
                    .map((sec) => (
                      <div
                        key={sec.id}
                        className="p-1.5 bg-white border border-slate-200 rounded-sm flex items-center justify-between text-[13px]"
                      >
                        <span className="text-slate-700 truncate">{sec.name}</span>
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: secondaryColor }}
                        />
                      </div>
                    ))
                )}
              </div>

              {/* Footer */}
              <div className="p-2 bg-slate-900 text-slate-400 text-[13px] text-center">
                © 2026 {brandName}. Powered by SokoFlow.
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-sm p-2 flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-950 shrink-0 mt-0.5" />
              <p className="text-[13px] text-blue-950">
                Changes preview in real-time. Click{' '}
                <span className="font-medium">Save changes</span> to publish.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* RESET DIALOG */}
      {isResetDialogOpen && (
        <div
          className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setIsResetDialogOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl text-center space-y-3 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-sm bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Reset to defaults?</h3>
              <p className="text-slate-500 mt-1">
                All palettes, typography, and layout settings will revert to factory defaults.
                This cannot be undone.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => setIsResetDialogOpen(false)}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={resetDefaults}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-sm text-[13px]"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Colour dot ---------- */
function ColorDot({ color, title }: { color: string; title: string }) {
  return (
    <span
      title={title}
      className="w-4 h-4 rounded-full border border-black/10"
      style={{ backgroundColor: color }}
    />
  );
}

/* ---------- Colour field ---------- */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-800 truncate">{label}</p>
        <p className="text-[13px] text-slate-400 font-mono truncate">{value}</p>
      </div>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded-sm cursor-pointer bg-transparent border-0 shrink-0"
      />
    </div>
  );
}

/* ---------- Logo slot ---------- */
function LogoSlot({
  label,
  image,
  dark,
  uploadRef,
  onChange,
}: {
  label: string;
  image: string;
  dark?: boolean;
  uploadRef: React.RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <p className="text-[13px] font-medium text-slate-700 mb-1">{label}</p>
      <div
        className={`w-full h-16 rounded-sm border p-2 flex items-center justify-center overflow-hidden ${
          dark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <img
          src={image}
          alt=""
          className={`max-h-full max-w-full object-contain ${dark ? 'invert' : ''}`}
        />
      </div>
      <button
        onClick={() => uploadRef.current?.click()}
        className={`w-full mt-1.5 inline-flex items-center justify-center gap-1.5 font-medium py-2 rounded-sm text-[13px] border transition ${
          dark
            ? 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
        }`}
      >
        <Upload className={`w-3.5 h-3.5 ${dark ? 'text-blue-400' : 'text-blue-950'}`} />
        Upload
      </button>
      <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
    </div>
  );
}
