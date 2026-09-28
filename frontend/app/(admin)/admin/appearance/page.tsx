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
  PanelTop,
  PanelBottom,
  Compass,
  CreditCard,
  GalleryHorizontal,
  Store,
  ChevronRight,
  Plus,
  Trash2,
  Layers,
  Megaphone,
  ShoppingBag,
  Search,
  ShoppingCart,
  Menu,
  MapPin,
  Phone,
  Mail,
  Shield,
  Truck,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================
type AppearanceTab =
  | 'theme'
  | 'branding'
  | 'layout'
  | 'typography'
  | 'header'
  | 'footer'
  | 'navigation'
  | 'product-card'
  | 'checkout'
  | 'banners'
  | 'css';

interface ColorPalette {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  surface?: string;
  border?: string;
  muted?: string;
}

interface HomepageSection {
  id: string;
  name: string;
  enabled: boolean;
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  children?: { id: string; label: string; href: string }[];
}

interface StoreProfile {
  id: string;
  name: string;
  industry: string;
}

// ============================================================
// CONSTANTS
// ============================================================
const PRESET_PALETTES: ColorPalette[] = [
  { name: 'SokoFlow Dark Blue', primary: '#172554', secondary: '#0284c7', accent: '#f59e0b', background: '#f8fafc', text: '#0f172a', surface: '#ffffff', border: '#e2e8f0', muted: '#64748b' },
  { name: 'Emerald Commerce', primary: '#065f46', secondary: '#10b981', accent: '#f43f5e', background: '#f9fafb', text: '#111827', surface: '#ffffff', border: '#e5e7eb', muted: '#6b7280' },
  { name: 'Sunset Orange', primary: '#9a3412', secondary: '#ea580c', accent: '#0284c7', background: '#fffaf5', text: '#292524', surface: '#ffffff', border: '#f5e0d3', muted: '#78716c' },
  { name: 'Royal Purple', primary: '#581c87', secondary: '#9333ea', accent: '#ec4899', background: '#faf5ff', text: '#3b0764', surface: '#ffffff', border: '#e9d5ff', muted: '#7e22ce' },
  { name: 'Midnight Neon', primary: '#0f172a', secondary: '#22d3ee', accent: '#a3e635', background: '#020617', text: '#e2e8f0', surface: '#0b1220', border: '#1e293b', muted: '#94a3b8' },
  { name: 'Desert Clay', primary: '#7c2d12', secondary: '#d97706', accent: '#0d9488', background: '#fef7ed', text: '#431407', surface: '#ffffff', border: '#fed7aa', muted: '#9a3412' },
];

const HEADING_FONTS = ['Inter', 'Poppins', 'Plus Jakarta Sans', 'Playfair Display', 'Space Grotesk'];
const BODY_FONTS = ['Inter', 'Roboto', 'Open Sans', 'Plus Jakarta Sans', 'DM Sans'];

const THEME_PRESETS = [
  { id: 'modern', name: 'Modern Storefront', desc: 'Bold hero, featured products, clean checkout.', sections: ['hero', 'categories', 'deals', 'new-arrivals', 'best-sellers'] },
  { id: 'minimal', name: 'Minimal Boutique', desc: 'Single column, editorial spacing, quiet CTAs.', sections: ['hero', 'new-arrivals', 'newsletter'] },
  { id: 'marketplace', name: 'Marketplace', desc: 'Dense product grid, category-first navigation.', sections: ['hero', 'categories', 'deals', 'best-sellers', 'newsletter'] },
  { id: 'electronics', name: 'Electronics Store', desc: 'Deals-led layout for hardware and accessories.', sections: ['hero', 'deals', 'categories', 'best-sellers', 'new-arrivals'] },
] as const;

const STORE_PROFILES: StoreProfile[] = [
  { id: 'store-a', name: 'SokoFlow Electronics', industry: 'Electronics' },
  { id: 'store-b', name: 'Mama Njeri Groceries', industry: 'Groceries' },
  { id: 'store-c', name: 'Brenda Beauty Studio', industry: 'Cosmetics' },
];

const TABS: { id: AppearanceTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'theme', label: 'Theme', icon: Palette },
  { id: 'branding', label: 'Branding', icon: ImageIcon },
  { id: 'layout', label: 'Layout', icon: Layout },
  { id: 'typography', label: 'Typography', icon: Type },
  { id: 'header', label: 'Header', icon: PanelTop },
  { id: 'footer', label: 'Footer', icon: PanelBottom },
  { id: 'navigation', label: 'Navigation', icon: Compass },
  { id: 'product-card', label: 'Product card', icon: ShoppingBag },
  { id: 'checkout', label: 'Checkout', icon: CreditCard },
  { id: 'banners', label: 'Banners', icon: GalleryHorizontal },
  { id: 'css', label: 'Custom CSS', icon: Code2 },
];

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================
export default function AppearanceThemePage() {
  const [activeTab, setActiveTab] = useState<AppearanceTab>('theme');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  // ── Multi-tenant store switcher ──
  const [activeStoreId, setActiveStoreId] = useState('store-a');
  const activeStore = STORE_PROFILES.find((s) => s.id === activeStoreId) || STORE_PROFILES[0];

  // ── Preview device ──
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // ── THEME ──
  const [primaryColor, setPrimaryColor] = useState('#172554');
  const [secondaryColor, setSecondaryColor] = useState('#0284c7');
  const [accentColor, setAccentColor] = useState('#f59e0b');
  const [bgColor, setBgColor] = useState('#f8fafc');
  const [surfaceColor, setSurfaceColor] = useState('#ffffff');
  const [borderColor, setBorderColor] = useState('#e2e8f0');
  const [textColor, setTextColor] = useState('#0f172a');
  const [mutedColor, setMutedColor] = useState('#64748b');
  const [radius, setRadius] = useState('4');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // ── BRANDING ──
  const [brandName, setBrandName] = useState('SokoFlow Electronics');
  const [tagline, setTagline] = useState('Conversational Commerce for WhatsApp & M-Pesa');
  const [lightLogo, setLightLogo] = useState('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80');
  const [darkLogo, setDarkLogo] = useState('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80');
  const [favicon, setFavicon] = useState('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=64&q=80');
  const [logoHeight, setLogoHeight] = useState('32');

  // ── LAYOUT ──
  const [sections, setSections] = useState<HomepageSection[]>([
    { id: 'hero', name: 'Hero banner', enabled: true },
    { id: 'categories', name: 'Categories grid', enabled: true },
    { id: 'deals', name: 'Flash deals & discounts', enabled: true },
    { id: 'new-arrivals', name: 'New arrivals', enabled: true },
    { id: 'best-sellers', name: 'Best sellers', enabled: true },
    { id: 'newsletter', name: 'Newsletter signup', enabled: false },
  ]);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  // ── TYPOGRAPHY ──
  const [headingFont, setHeadingFont] = useState('Inter');
  const [bodyFont, setBodyFont] = useState('Inter');
  const [headingWeight, setHeadingWeight] = useState('700');
  const [letterSpacing, setLetterSpacing] = useState('0');
  const [baseFontSize, setBaseFontSize] = useState('16');
  const [lineHeight, setLineHeight] = useState('1.5');

  // ── HEADER ──
  const [headerStyle, setHeaderStyle] = useState<'classic' | 'centered' | 'minimal'>('classic');
  const [headerHeight, setHeaderHeight] = useState('64');
  const [headerSticky, setHeaderSticky] = useState(true);
  const [headerShowSearch, setHeaderShowSearch] = useState(true);
  const [headerShowCart, setHeaderShowCart] = useState(true);
  const [headerShowWishlist, setHeaderShowWishlist] = useState(true);
  const [headerTopBar, setHeaderTopBar] = useState(true);
  const [headerTopBarText, setHeaderTopBarText] = useState('Free same-day delivery in Nairobi on orders above KES 5,000');

  // ── FOOTER ──
  const [footerStyle, setFooterStyle] = useState<'columns' | 'compact' | 'expanded'>('columns');
  const [footerBg, setFooterBg] = useState('#0f172a');
  const [footerText, setFooterText] = useState('#94a3b8');
  const [footerColumns, setFooterColumns] = useState(4);
  const [footerNewsletter, setFooterNewsletter] = useState(true);
  const [footerPaymentIcons, setFooterPaymentIcons] = useState(true);
  const [footerCopyright, setFooterCopyright] = useState('© 2026 {brand}. Powered by SokoFlow.');
  const [footerSocials, setFooterSocials] = useState(true);

  // ── NAVIGATION ──
  const [navItems, setNavItems] = useState<NavItem[]>([
    {
      id: 'nav-1',
      label: 'Shop',
      href: '/shop',
      children: [
        { id: 'nav-1-1', label: 'Routers', href: '/shop/routers' },
        { id: 'nav-1-2', label: 'Monitors', href: '/shop/monitors' },
        { id: 'nav-1-3', label: 'Keyboards', href: '/shop/keyboards' },
        { id: 'nav-1-4', label: 'Accessories', href: '/shop/accessories' },
      ],
    },
    { id: 'nav-2', label: 'Deals', href: '/deals' },
    { id: 'nav-3', label: 'Blog', href: '/blog' },
    { id: 'nav-4', label: 'About', href: '/about' },
    { id: 'nav-5', label: 'Contact', href: '/contact' },
  ]);
  const [navMobileStyle, setNavMobileStyle] = useState<'drawer' | 'fullscreen' | 'bottom-bar'>('drawer');
  const [navUppercase, setNavUppercase] = useState(false);
  const [navShowIcons, setNavShowIcons] = useState(false);

  // ── PRODUCT CARD ──
  const [cardImageRatio, setCardImageRatio] = useState<'1:1' | '4:3' | '3:4' | '16:9'>('1:1');
  const [cardHover, setCardHover] = useState<'zoom' | 'lift' | 'none'>('zoom');
  const [cardShowBadge, setCardShowBadge] = useState(true);
  const [cardShowRating, setCardShowRating] = useState(true);
  const [cardShowQuickAdd, setCardShowQuickAdd] = useState(true);
  const [cardShowWhatsApp, setCardShowWhatsApp] = useState(true);
  const [cardBorder, setCardBorder] = useState(true);

  // ── CHECKOUT ──
  const [checkoutLayout, setCheckoutLayout] = useState<'single-page' | 'two-column' | 'stepper'>('two-column');
  const [checkoutWhatsAppButton, setCheckoutWhatsAppButton] = useState(true);
  const [checkoutTrustBadges, setCheckoutTrustBadges] = useState(true);
  const [checkoutMpesaFirst, setCheckoutMpesaFirst] = useState(true);
  const [checkoutShowNotes, setCheckoutShowNotes] = useState(true);
  const [checkoutShowCoupon, setCheckoutShowCoupon] = useState(true);

  // ── BANNERS ──
  const [announcementEnabled, setAnnouncementEnabled] = useState(true);
  const [announcementText, setAnnouncementText] = useState('🔥 Weekend Flash Sale — up to 20% off electronics. Ends Sunday midnight.');
  const [announcementBg, setAnnouncementBg] = useState('#172554');
  const [announcementTextColor, setAnnouncementTextColor] = useState('#ffffff');
  const [heroStyle, setHeroStyle] = useState<'split' | 'centered' | 'image-bg' | 'carousel'>('split');
  const [promoStripEnabled, setPromoStripEnabled] = useState(true);
  const [promoStripText, setPromoStripText] = useState('Pay with M-Pesa · Instant STK push · Same-day Nairobi delivery');

  // ── CUSTOM CSS ──
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
    if (palette.surface) setSurfaceColor(palette.surface);
    if (palette.border) setBorderColor(palette.border);
    if (palette.muted) setMutedColor(palette.muted);
    setActivePresetId(null);
    toast(`Applied ${palette.name}`);
  };

  const applyThemePreset = (presetId: string) => {
    const preset = THEME_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSections((prev) => prev.map((s) => ({ ...s, enabled: preset.sections.includes(s.id) })));
    setActivePresetId(presetId);
    toast(`Theme preset: ${preset.name}`);
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
    setSections((prev) => prev.map((sec) => (sec.id === id ? { ...sec, enabled: !sec.enabled } : sec)));
  };

  const addNavItem = () => {
    setNavItems((prev) => [...prev, { id: `nav-${Date.now()}`, label: 'New link', href: '/new' }]);
    toast('Nav item added');
  };

  const updateNavItem = (id: string, patch: Partial<NavItem>) => {
    setNavItems((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  const removeNavItem = (id: string) => {
    setNavItems((prev) => prev.filter((n) => n.id !== id));
    toast('Nav item removed');
  };

  const saveAll = () => toast(`Appearance saved for ${activeStore.name}`);

  const resetDefaults = () => {
    setPrimaryColor('#172554');
    setSecondaryColor('#0284c7');
    setAccentColor('#f59e0b');
    setBgColor('#f8fafc');
    setSurfaceColor('#ffffff');
    setBorderColor('#e2e8f0');
    setTextColor('#0f172a');
    setMutedColor('#64748b');
    setRadius('4');
    setActivePresetId(null);
    setBrandName('SokoFlow Electronics');
    setTagline('Conversational Commerce for WhatsApp & M-Pesa');
    setHeadingFont('Inter');
    setBodyFont('Inter');
    setHeadingWeight('700');
    setLetterSpacing('0');
    setBaseFontSize('16');
    setLineHeight('1.5');
    setHeaderStyle('classic');
    setFooterStyle('columns');
    setNavMobileStyle('drawer');
    setIsResetDialogOpen(false);
    toast('Reset to defaults');
  };

  const enabledSections = sections.filter((s) => s.enabled);

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
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              Appearance & theme
              <span className="inline-flex items-center gap-1 text-[13px] font-medium bg-blue-50 text-blue-950 border border-blue-100 px-2 py-0.5 rounded-sm">
                <Store className="w-3 h-3" />
                {activeStore.name}
              </span>
            </h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              White-label storefront configurator — each tenant keeps its own branding on shared code
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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

        {/* Store switcher */}
        <div className="max-w-[1600px] mx-auto px-3 pb-2 flex items-center gap-2 overflow-x-auto">
          <span className="text-[13px] text-slate-400 shrink-0">Preview as:</span>
          {STORE_PROFILES.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveStoreId(s.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[13px] font-medium border transition whitespace-nowrap ${activeStoreId === s.id
                  ? 'bg-blue-950 text-white border-blue-950'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
            >
              <Store className="w-3 h-3" />
              {s.name}
              <span className={`text-[13px] ${activeStoreId === s.id ? 'text-blue-200' : 'text-slate-400'}`}>
                {s.industry}
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* TABS */}
      <div className="bg-white border-b border-slate-200 sticky top-[105px] z-20">
        <div className="max-w-[1600px] mx-auto px-3 flex gap-0.5 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium border-b-2 transition whitespace-nowrap ${isActive
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
            <div className="space-y-3">
              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
                <div>
                  <p className="text-[13px] font-medium text-slate-900">Preset palettes</p>
                  <p className="text-[13px] text-slate-500 mt-0.5">Click any preset to apply instant colour harmony</p>
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
              </div>

              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
                <p className="text-[13px] font-medium text-slate-900">Custom colours</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <ColorField label="Primary" value={primaryColor} onChange={setPrimaryColor} />
                  <ColorField label="Secondary" value={secondaryColor} onChange={setSecondaryColor} />
                  <ColorField label="Accent / CTA" value={accentColor} onChange={setAccentColor} />
                  <ColorField label="Background" value={bgColor} onChange={setBgColor} />
                  <ColorField label="Surface / cards" value={surfaceColor} onChange={setSurfaceColor} />
                  <ColorField label="Border" value={borderColor} onChange={setBorderColor} />
                  <ColorField label="Text" value={textColor} onChange={setTextColor} />
                  <ColorField label="Muted text" value={mutedColor} onChange={setMutedColor} />
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-medium text-slate-700">Corner radius</span>
                    <span className="font-mono text-blue-950 text-[13px]">{radius}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                    className="w-full accent-blue-950"
                  />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-blue-950" />
                  <p className="text-[13px] font-medium text-slate-900">Storefront theme presets</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {THEME_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => applyThemePreset(p.id)}
                      className={`p-2 rounded-sm border text-left transition ${activePresetId === p.id
                          ? 'border-blue-950 bg-blue-50/40'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      <p className="text-[13px] font-medium text-slate-900">{p.name}</p>
                      <p className="text-[13px] text-slate-500 mt-0.5">{p.desc}</p>
                      <p className="text-[13px] text-slate-400 font-mono mt-1">
                        {p.sections.length} sections
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* BRANDING */}
          {activeTab === 'branding' && (
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
              <div>
                <p className="text-[13px] font-medium text-slate-900">Brand identity</p>
                <p className="text-[13px] text-slate-500 mt-0.5">Store name, tagline, and logos for light/dark mode</p>
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

              <div className="pt-2 border-t border-slate-100 text-[13px]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-700">Logo display height</span>
                  <span className="font-mono text-blue-950">{logoHeight}px</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="56"
                  step="2"
                  value={logoHeight}
                  onChange={(e) => setLogoHeight(e.target.value)}
                  className="w-full accent-blue-950"
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-[13px] font-medium text-slate-700 mb-1">Browser favicon</p>
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
                <p className="text-[13px] text-slate-500 mt-0.5">Drag to reorder or toggle individual sections</p>
              </div>
              <ul className="space-y-1.5">
                {sections.map((sec, index) => (
                  <li
                    key={sec.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`p-2 border rounded-sm flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing transition ${sec.enabled ? 'bg-white border-slate-200' : 'bg-slate-50 border-dashed border-slate-300 opacity-70'
                      }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-[13px] font-medium text-slate-800 truncate">{sec.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[13px] font-medium px-1.5 py-0.5 rounded-sm ${sec.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}
                      >
                        {sec.enabled ? 'Visible' : 'Hidden'}
                      </span>
                      <button
                        onClick={() => toggleSection(sec.id)}
                        className={`px-2.5 py-1.5 rounded-sm text-[13px] font-medium transition border ${sec.enabled
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
                <p className="text-[13px] text-slate-500 mt-0.5">Font families and scale for your storefront</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
                <label className="block">
                  <span className="block font-medium text-slate-700 mb-1">Headings font</span>
                  <select
                    value={headingFont}
                    onChange={(e) => setHeadingFont(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  >
                    {HEADING_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block font-medium text-slate-700 mb-1">Body font</span>
                  <select
                    value={bodyFont}
                    onChange={(e) => setBodyFont(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  >
                    {BODY_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block font-medium text-slate-700 mb-1">Heading weight</span>
                  <select
                    value={headingWeight}
                    onChange={(e) => setHeadingWeight(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  >
                    {['400', '500', '600', '700', '800'].map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block font-medium text-slate-700 mb-1">Letter spacing</span>
                  <select
                    value={letterSpacing}
                    onChange={(e) => setLetterSpacing(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  >
                    <option value="-0.5">-0.5px (tight)</option>
                    <option value="0">0 (normal)</option>
                    <option value="0.5">0.5px (relaxed)</option>
                    <option value="1">1px (wide)</option>
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

              <div className="pt-2 border-t border-slate-100">
                <p className="text-[13px] font-medium text-slate-700 mb-1">Preview</p>
                <div className="p-2 border border-slate-200 rounded-sm bg-slate-50">
                  <p
                    className="text-[15px] font-bold text-slate-900"
                    style={{ fontFamily: headingFont, fontWeight: headingWeight, letterSpacing: `${letterSpacing}px` }}
                  >
                    The quick brown fox jumps over the lazy dog
                  </p>
                  <p
                    className="text-[13px] text-slate-600 mt-1"
                    style={{ fontFamily: bodyFont, fontSize: `${baseFontSize}px`, lineHeight }}
                  >
                    Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* HEADER */}
          {activeTab === 'header' && (
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
              <div>
                <p className="text-[13px] font-medium text-slate-900">Header configuration</p>
                <p className="text-[13px] text-slate-500 mt-0.5">Layout, controls, and top bar</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[13px]">
                {(['classic', 'centered', 'minimal'] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => setHeaderStyle(style)}
                    className={`p-2 rounded-sm border text-left capitalize transition ${headerStyle === style ? 'border-blue-950 bg-blue-50/40 text-blue-950' : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    <span className="text-[13px] font-medium">{style}</span>
                  </button>
                ))}
              </div>

              <div className="text-[13px]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-700">Header height</span>
                  <span className="font-mono text-blue-950">{headerHeight}px</span>
                </div>
                <input
                  type="range"
                  min="48"
                  max="96"
                  step="4"
                  value={headerHeight}
                  onChange={(e) => setHeaderHeight(e.target.value)}
                  className="w-full accent-blue-950"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
                <Toggle label="Sticky on scroll" value={headerSticky} onChange={setHeaderSticky} />
                <Toggle label="Show search icon" value={headerShowSearch} onChange={setHeaderShowSearch} />
                <Toggle label="Show cart icon" value={headerShowCart} onChange={setHeaderShowCart} />
                <Toggle label="Show wishlist icon" value={headerShowWishlist} onChange={setHeaderShowWishlist} />
                <Toggle label="Enable top bar" value={headerTopBar} onChange={setHeaderTopBar} />
              </div>

              {headerTopBar && (
                <label className="block text-[13px]">
                  <span className="block font-medium text-slate-700 mb-1">Top bar text</span>
                  <input
                    type="text"
                    value={headerTopBarText}
                    onChange={(e) => setHeaderTopBarText(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                </label>
              )}
            </div>
          )}

          {/* FOOTER */}
          {activeTab === 'footer' && (
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
              <div>
                <p className="text-[13px] font-medium text-slate-900">Footer configuration</p>
                <p className="text-[13px] text-slate-500 mt-0.5">Layout, colours, columns, and trust elements</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[13px]">
                {(['columns', 'compact', 'expanded'] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => setFooterStyle(style)}
                    className={`p-2 rounded-sm border text-left capitalize transition ${footerStyle === style ? 'border-blue-950 bg-blue-50/40 text-blue-950' : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    <span className="text-[13px] font-medium">{style}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
                <ColorField label="Footer background" value={footerBg} onChange={setFooterBg} />
                <ColorField label="Footer text" value={footerText} onChange={setFooterText} />
              </div>

              <div className="text-[13px]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-700">Footer columns</span>
                  <span className="font-mono text-blue-950">{footerColumns}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="5"
                  step="1"
                  value={footerColumns}
                  onChange={(e) => setFooterColumns(Number(e.target.value))}
                  className="w-full accent-blue-950"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
                <Toggle label="Newsletter signup block" value={footerNewsletter} onChange={setFooterNewsletter} />
                <Toggle label="Payment method icons" value={footerPaymentIcons} onChange={setFooterPaymentIcons} />
                <Toggle label="Social media icons" value={footerSocials} onChange={setFooterSocials} />
              </div>

              <label className="block text-[13px]">
                <span className="block font-medium text-slate-700 mb-1">Copyright line</span>
                <input
                  type="text"
                  value={footerCopyright}
                  onChange={(e) => setFooterCopyright(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
                <span className="text-[13px] text-slate-400">Use {'{brand}'} as a placeholder for the store name</span>
              </label>
            </div>
          )}

          {/* NAVIGATION */}
          {activeTab === 'navigation' && (
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-slate-900">Menu items</p>
                  <p className="text-[13px] text-slate-500 mt-0.5">Reorder or add top-level navigation</p>
                </div>
                <button
                  onClick={addNavItem}
                  className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-2 rounded-sm text-[13px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add link
                </button>
              </div>

              <ul className="space-y-1.5">
                {navItems.map((item) => (
                  <li key={item.id} className="p-2 border border-slate-200 rounded-sm bg-white space-y-2">
                    <div className="flex items-center gap-2 text-[13px]">
                      <GripVertical className="w-4 h-4 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => updateNavItem(item.id, { label: e.target.value })}
                        placeholder="Label"
                        className="flex-1 bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                      />
                      <input
                        type="text"
                        value={item.href}
                        onChange={(e) => updateNavItem(item.id, { href: e.target.value })}
                        placeholder="/href"
                        className="flex-1 bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
                      />
                      <button onClick={() => removeNavItem(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-sm">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {item.children && item.children.length > 0 && (
                      <div className="pl-6 space-y-1">
                        {item.children.map((c) => (
                          <div key={c.id} className="flex items-center gap-2 text-[13px] text-slate-500">
                            <ChevronRight className="w-3 h-3 shrink-0" />
                            <span className="truncate">{c.label}</span>
                            <span className="font-mono truncate">{c.href}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <div className="pt-2 border-t border-slate-100 space-y-2 text-[13px]">
                <p className="font-medium text-slate-700">Mobile navigation style</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['drawer', 'fullscreen', 'bottom-bar'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setNavMobileStyle(style)}
                      className={`p-2 rounded-sm border text-[13px] font-medium capitalize transition ${navMobileStyle === style ? 'border-blue-950 bg-blue-50/40 text-blue-950' : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      {style.replace('-', ' ')}
                    </button>
                  ))}
                </div>
                <Toggle label="Uppercase menu labels" value={navUppercase} onChange={setNavUppercase} />
                <Toggle label="Show icons next to items" value={navShowIcons} onChange={setNavShowIcons} />
              </div>
            </div>
          )}

          {/* PRODUCT CARD */}
          {activeTab === 'product-card' && (
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
              <div>
                <p className="text-[13px] font-medium text-slate-900">Product card style</p>
                <p className="text-[13px] text-slate-500 mt-0.5">How products appear in grids, carousels, and search</p>
              </div>

              <div className="text-[13px] space-y-2">
                <p className="font-medium text-slate-700">Image aspect ratio</p>
                <div className="grid grid-cols-4 gap-2">
                  {(['1:1', '4:3', '3:4', '16:9'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setCardImageRatio(r)}
                      className={`p-2 rounded-sm border text-[13px] font-medium transition ${cardImageRatio === r ? 'border-blue-950 bg-blue-50/40 text-blue-950' : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-[13px] space-y-2">
                <p className="font-medium text-slate-700">Hover effect</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['zoom', 'lift', 'none'] as const).map((h) => (
                    <button
                      key={h}
                      onClick={() => setCardHover(h)}
                      className={`p-2 rounded-sm border text-[13px] font-medium capitalize transition ${cardHover === h ? 'border-blue-950 bg-blue-50/40 text-blue-950' : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
                <Toggle label="Show discount badge" value={cardShowBadge} onChange={setCardShowBadge} />
                <Toggle label="Show star rating" value={cardShowRating} onChange={setCardShowRating} />
                <Toggle label="Quick add to cart button" value={cardShowQuickAdd} onChange={setCardShowQuickAdd} />
                <Toggle label="WhatsApp order button" value={cardShowWhatsApp} onChange={setCardShowWhatsApp} />
                <Toggle label="Card border & shadow" value={cardBorder} onChange={setCardBorder} />
              </div>
            </div>
          )}

          {/* CHECKOUT */}
          {activeTab === 'checkout' && (
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
              <div>
                <p className="text-[13px] font-medium text-slate-900">Checkout appearance</p>
                <p className="text-[13px] text-slate-500 mt-0.5">Layout, payment flow, and trust elements</p>
              </div>

              <div className="text-[13px] space-y-2">
                <p className="font-medium text-slate-700">Layout</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['single-page', 'two-column', 'stepper'] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setCheckoutLayout(l)}
                      className={`p-2 rounded-sm border text-[13px] font-medium transition capitalize ${checkoutLayout === l ? 'border-blue-950 bg-blue-50/40 text-blue-950' : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      {l.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
                <Toggle label="M-Pesa as default method" value={checkoutMpesaFirst} onChange={setCheckoutMpesaFirst} />
                <Toggle label="Show WhatsApp order button" value={checkoutWhatsAppButton} onChange={setCheckoutWhatsAppButton} />
                <Toggle label="Show trust badges" value={checkoutTrustBadges} onChange={setCheckoutTrustBadges} />
                <Toggle label="Enable order notes field" value={checkoutShowNotes} onChange={setCheckoutShowNotes} />
                <Toggle label="Show coupon code field" value={checkoutShowCoupon} onChange={setCheckoutShowCoupon} />
              </div>
            </div>
          )}

          {/* BANNERS */}
          {activeTab === 'banners' && (
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
              <div>
                <p className="text-[13px] font-medium text-slate-900">Banners & announcements</p>
                <p className="text-[13px] text-slate-500 mt-0.5">Top-of-page messaging and hero layouts</p>
              </div>

              <div className="space-y-2 text-[13px]">
                <Toggle label="Announcement bar" value={announcementEnabled} onChange={setAnnouncementEnabled} />
                {announcementEnabled && (
                  <>
                    <label className="block">
                      <span className="block font-medium text-slate-700 mb-1">Announcement text</span>
                      <input
                        type="text"
                        value={announcementText}
                        onChange={(e) => setAnnouncementText(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                      />
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <ColorField label="Bar background" value={announcementBg} onChange={setAnnouncementBg} />
                      <ColorField label="Bar text colour" value={announcementTextColor} onChange={setAnnouncementTextColor} />
                    </div>
                  </>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 text-[13px] space-y-2">
                <p className="font-medium text-slate-700">Hero style</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['split', 'centered', 'image-bg', 'carousel'] as const).map((h) => (
                    <button
                      key={h}
                      onClick={() => setHeroStyle(h)}
                      className={`p-2 rounded-sm border text-[13px] font-medium transition capitalize ${heroStyle === h ? 'border-blue-950 bg-blue-50/40 text-blue-950' : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      {h.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2 text-[13px]">
                <Toggle label="Promo strip below header" value={promoStripEnabled} onChange={setPromoStripEnabled} />
                {promoStripEnabled && (
                  <input
                    type="text"
                    value={promoStripText}
                    onChange={(e) => setPromoStripText(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                )}
              </div>
            </div>
          )}

          {/* CUSTOM CSS */}
          {activeTab === 'css' && (
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-slate-900">Custom CSS</p>
                  <p className="text-[13px] text-slate-500 mt-0.5">Injected directly into the storefront header</p>
                </div>
                <span className="px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 font-mono text-[13px] font-medium">CSS 3.0</span>
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
          <div className="sticky top-40 bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-blue-950" />
                <span className="text-[13px] font-medium text-slate-900">Live preview</span>
                <span className="text-[13px] text-slate-400 font-mono">· {activeStore.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-1.5 rounded-sm transition ${previewDevice === 'mobile' ? 'text-blue-950 bg-blue-50' : 'text-slate-400 hover:text-slate-800'}`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-1.5 rounded-sm transition ${previewDevice === 'desktop' ? 'text-blue-950 bg-blue-50' : 'text-slate-400 hover:text-slate-800'}`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className={`mx-auto transition-all ${previewDevice === 'mobile' ? 'max-w-[360px]' : 'max-w-full'}`}>
              <div
                className="border overflow-hidden"
                style={{
                  backgroundColor: bgColor,
                  color: textColor,
                  fontFamily: bodyFont,
                  borderRadius: `${radius}px`,
                  borderColor: borderColor,
                }}
              >
                {announcementEnabled && (
                  <div
                    className="px-2 py-1 text-center text-[13px] font-medium truncate"
                    style={{ backgroundColor: announcementBg, color: announcementTextColor }}
                  >
                    {announcementText}
                  </div>
                )}

                {headerTopBar && (
                  <div
                    className="px-2 py-1 text-[13px] flex items-center justify-center gap-1 truncate"
                    style={{ backgroundColor: primaryColor, color: '#ffffff' }}
                  >
                    <Megaphone className="w-3 h-3 shrink-0" />
                    <span className="truncate">{headerTopBarText}</span>
                  </div>
                )}

                <div
                  className="px-2 flex items-center justify-between gap-2"
                  style={{
                    backgroundColor: surfaceColor,
                    height: `${headerHeight}px`,
                    borderBottom: `1px solid ${borderColor}`,
                    ...(headerStyle === 'centered' ? { justifyContent: 'center', textAlign: 'center' } : {}),
                  }}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <img
                      src={lightLogo}
                      alt=""
                      className="rounded-sm object-cover bg-white shrink-0"
                      style={{ height: `${logoHeight}px`, width: `${logoHeight}px` }}
                    />
                    <span className="text-[13px] font-semibold truncate" style={{ color: textColor }}>
                      {brandName}
                    </span>
                  </div>

                  {headerStyle === 'classic' && (
                    <nav className="hidden sm:flex items-center gap-2 text-[13px]">
                      {navItems.slice(0, 4).map((n) => (
                        <span
                          key={n.id}
                          className="truncate"
                          style={{
                            color: mutedColor,
                            textTransform: navUppercase ? 'uppercase' : 'none',
                            letterSpacing: navUppercase ? '0.05em' : 'normal',
                          }}
                        >
                          {n.label}
                        </span>
                      ))}
                    </nav>
                  )}

                  <div className="flex items-center gap-1.5 shrink-0" style={{ color: mutedColor }}>
                    {headerShowSearch && <Search className="w-3.5 h-3.5" />}
                    {headerShowWishlist && <Sparkles className="w-3.5 h-3.5" />}
                    {headerShowCart && <ShoppingCart className="w-3.5 h-3.5" />}
                    <Menu className="w-3.5 h-3.5 sm:hidden" />
                  </div>
                </div>

                {promoStripEnabled && (
                  <div
                    className="px-2 py-1 text-[13px] flex items-center justify-center gap-1 truncate"
                    style={{ backgroundColor: accentColor, color: '#ffffff' }}
                  >
                    <Sparkles className="w-3 h-3 shrink-0" />
                    <span className="truncate">{promoStripText}</span>
                  </div>
                )}

                <div className="p-3 text-center space-y-2" style={{ backgroundColor: `${primaryColor}10` }}>
                  <p
                    className="text-[13px] font-semibold tracking-tight"
                    style={{ fontFamily: headingFont, color: textColor, fontWeight: headingWeight }}
                  >
                    {tagline}
                  </p>
                  <p className="text-[13px] max-w-xs mx-auto" style={{ color: mutedColor }}>
                    Instant STK Push checkout directly over WhatsApp
                  </p>
                  <button
                    className="px-3 py-1.5 text-[13px] font-medium shadow-sm"
                    style={{ backgroundColor: accentColor, color: '#ffffff', borderRadius: `${radius}px` }}
                  >
                    Order via WhatsApp
                  </button>
                </div>

                <div className="p-2 space-y-1.5" style={{ backgroundColor: bgColor }}>
                  <p className="text-[13px] font-medium mb-1" style={{ color: mutedColor }}>
                    Active homepage blocks
                  </p>
                  {enabledSections.length === 0 ? (
                    <p className="text-[13px] italic" style={{ color: mutedColor }}>No sections enabled</p>
                  ) : (
                    enabledSections.map((sec) => (
                      <div
                        key={sec.id}
                        className="p-1.5 flex items-center justify-between text-[13px]"
                        style={{ backgroundColor: surfaceColor, border: `1px solid ${borderColor}`, borderRadius: `${radius}px` }}
                      >
                        <span className="truncate" style={{ color: textColor }}>{sec.name}</span>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: secondaryColor }} />
                      </div>
                    ))
                  )}
                </div>

                {activeTab === 'product-card' && (
                  <div className="p-2 grid grid-cols-2 gap-2" style={{ backgroundColor: bgColor }}>
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className="overflow-hidden"
                        style={{
                          backgroundColor: surfaceColor,
                          border: cardBorder ? `1px solid ${borderColor}` : 'none',
                          borderRadius: `${radius}px`,
                        }}
                      >
                        <div
                          className="bg-slate-200 flex items-center justify-center"
                          style={{ aspectRatio: cardImageRatio.replace(':', '/') }}
                        >
                          <ShoppingBag className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="p-2 space-y-1">
                          <p className="text-[13px] font-medium truncate" style={{ color: textColor }}>Wi-Fi 6 Router</p>
                          <div className="flex items-center gap-1">
                            <span className="text-[13px] font-mono" style={{ color: textColor }}>KES 6,500</span>
                            {cardShowBadge && (
                              <span className="text-[13px] px-1 rounded-sm" style={{ backgroundColor: accentColor, color: '#fff' }}>
                                -20%
                              </span>
                            )}
                          </div>
                          {cardShowRating && (
                            <p className="text-[13px]" style={{ color: mutedColor }}>★★★★★ (128)</p>
                          )}
                          {cardShowQuickAdd && (
                            <button
                              className="w-full text-[13px] py-1 font-medium"
                              style={{ backgroundColor: primaryColor, color: '#fff', borderRadius: `${radius}px` }}
                            >
                              Add to cart
                            </button>
                          )}
                          {cardShowWhatsApp && (
                            <button
                              className="w-full text-[13px] py-1 font-medium"
                              style={{ backgroundColor: '#25D366', color: '#fff', borderRadius: `${radius}px` }}
                            >
                              Order on WhatsApp
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'checkout' && (
                  <div className="p-2 space-y-2" style={{ backgroundColor: bgColor }}>
                    <div
                      className="p-2 space-y-2"
                      style={{ backgroundColor: surfaceColor, border: `1px solid ${borderColor}`, borderRadius: `${radius}px` }}
                    >
                      <p className="text-[13px] font-semibold" style={{ color: textColor }}>Checkout</p>
                      <div className={`gap-2 ${checkoutLayout === 'two-column' ? 'grid grid-cols-2' : 'space-y-2'}`}>
                        <div className="space-y-1">
                          <input disabled placeholder="Full name" className="w-full text-[13px] px-2 py-1.5 border rounded-sm" style={{ borderColor: borderColor }} />
                          <input disabled placeholder="Phone number" className="w-full text-[13px] px-2 py-1.5 border rounded-sm" style={{ borderColor: borderColor }} />
                          {checkoutShowNotes && (
                            <textarea disabled rows={2} placeholder="Delivery notes" className="w-full text-[13px] px-2 py-1.5 border rounded-sm resize-none" style={{ borderColor: borderColor }} />
                          )}
                        </div>
                        <div className="space-y-1">
                          {checkoutMpesaFirst && (
                            <div className="flex items-center gap-2 p-1.5 border rounded-sm" style={{ borderColor: primaryColor }}>
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: primaryColor }} />
                              <span className="text-[13px]" style={{ color: textColor }}>M-Pesa STK Push</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 p-1.5 border rounded-sm" style={{ borderColor: borderColor }}>
                            <span className="w-3 h-3 rounded-full border" style={{ borderColor: mutedColor }} />
                            <span className="text-[13px]" style={{ color: textColor }}>Cash on delivery</span>
                          </div>
                          {checkoutShowCoupon && (
                            <input disabled placeholder="Coupon code" className="w-full text-[13px] px-2 py-1.5 border rounded-sm" style={{ borderColor: borderColor }} />
                          )}
                        </div>
                      </div>
                      {checkoutTrustBadges && (
                        <div className="flex items-center gap-2 pt-1 text-[13px]" style={{ color: mutedColor }}>
                          <Shield className="w-3 h-3" /> Secure
                          <Truck className="w-3 h-3" /> Same-day
                          <CreditCard className="w-3 h-3" /> M-Pesa
                        </div>
                      )}
                      {checkoutWhatsAppButton && (
                        <button
                          className="w-full text-[13px] py-1.5 font-medium"
                          style={{ backgroundColor: '#25D366', color: '#fff', borderRadius: `${radius}px` }}
                        >
                          Complete order on WhatsApp
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div
                  className="p-2 space-y-1.5"
                  style={{
                    backgroundColor: footerBg,
                    color: footerText,
                    fontSize: `${Math.max(11, Number(baseFontSize) - 3)}px`,
                  }}
                >
                  <div className={`gap-2 ${footerStyle === 'columns' ? 'grid grid-cols-2' : footerStyle === 'expanded' ? 'grid grid-cols-3' : 'flex flex-wrap'}`}>
                    {Array.from({ length: footerColumns }).map((_, i) => (
                      <div key={i} className="space-y-1">
                        <p className="font-medium opacity-90">Column {i + 1}</p>
                        <p className="opacity-60">Link</p>
                        <p className="opacity-60">Link</p>
                      </div>
                    ))}
                  </div>
                  {footerNewsletter && (
                    <div className="pt-1 border-t" style={{ borderColor: '#ffffff20' }}>
                      <p className="opacity-80">Newsletter signup</p>
                    </div>
                  )}
                  {footerPaymentIcons && (
                    <div className="flex items-center gap-2 pt-1 opacity-80">
                      <CreditCard className="w-3 h-3" /> M-Pesa
                      <CreditCard className="w-3 h-3" /> Visa
                      <CreditCard className="w-3 h-3" /> Mastercard
                    </div>
                  )}
                  {footerSocials && (
                    <div className="flex items-center gap-2 opacity-80">
                      <MapPin className="w-3 h-3" /> Nairobi
                      <Phone className="w-3 h-3" /> WhatsApp
                      <Mail className="w-3 h-3" /> Email
                    </div>
                  )}
                  <p className="text-center pt-1 opacity-60">
                    {footerCopyright.replace('{brand}', brandName)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-sm p-2 flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-950 shrink-0 mt-0.5" />
              <p className="text-[13px] text-blue-950">
                Changes preview in real-time for <span className="font-medium">{activeStore.name}</span>. Click{' '}
                <span className="font-medium">Save changes</span> to publish to this tenant only.
              </p>
            </div>
          </div>
        </div>
      </main>

      {isResetDialogOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={() => setIsResetDialogOpen(false)}>
          <div className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl text-center space-y-3 text-[13px]" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-sm bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Reset to defaults?</h3>
              <p className="text-slate-500 mt-1">
                All palettes, typography, header/footer, navigation, product card and checkout settings for{' '}
                <span className="font-medium text-slate-800">{activeStore.name}</span> will revert to factory defaults.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button onClick={() => setIsResetDialogOpen(false)} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]">Cancel</button>
              <button onClick={resetDefaults} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-sm text-[13px]">Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// HELPER COMPONENTS (top-level, outside main component)
// ============================================================
function ColorDot({ color, title }: { color: string; title: string }) {
  return (
    <span title={title} className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: color }} />
  );
}

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
        className={`w-full h-16 rounded-sm border p-2 flex items-center justify-center overflow-hidden ${dark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
      >
        <img src={image} alt="" className={`max-h-full max-w-full object-contain ${dark ? 'invert' : ''}`} />
      </div>
      <button
        onClick={() => uploadRef.current?.click()}
        className={`w-full mt-1.5 inline-flex items-center justify-center gap-1.5 font-medium py-2 rounded-sm text-[13px] border transition ${dark ? 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
      >
        <Upload className={`w-3.5 h-3.5 ${dark ? 'text-blue-400' : 'text-blue-950'}`} />
        Upload
      </button>
      <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-sm p-2 cursor-pointer">
      <span className="text-[13px] text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-8 h-4 rounded-full transition shrink-0 ${value ? 'bg-blue-950' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${value ? 'left-[18px]' : 'left-0.5'
            }`}
        />
      </button>
    </label>
  );
}