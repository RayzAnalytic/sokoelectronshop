'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  CheckCircle2,
  X,
  Trash2,
  Edit3,
  Copy,
  AlertCircle,
  Calendar,
  Eye,
  Sparkles,
  Upload,
} from 'lucide-react';

// --- TYPES ---
type BannerTab = 'Homepage Hero' | 'Promo Strips' | 'Category Banners' | 'Popups';
type BannerPosition = 'Homepage Hero' | 'Promo Strip' | 'Category Banner' | 'Popup';

interface HeroSlide {
  id: string;
  imageUrl: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaLink: string;
}

interface Banner {
  id: string;
  title: string;
  position: BannerPosition;
  slides: HeroSlide[]; // 6 for Homepage Hero, 1 for others
  startDate: string;
  endDate: string;
  active: boolean;
}

// --- HELPERS ---
const newSlide = (i: number): HeroSlide => ({
  id: `slide-${Date.now()}-${i}`,
  imageUrl: `https://images.unsplash.com/photo-${
    ['1557804506-669a67965ba0', '1526738549149-8e07eca6c147', '1542838132-92c53300491e', '1587829741301-dc798b83add3', '1563986768609-322da13575f3', '1607083206869-4c7672e72a8a'][i % 6]
  }?auto=format&fit=crop&w=800&q=80`,
  headline: '',
  subheadline: '',
  ctaText: 'Shop now',
  ctaLink: '/shop',
});

const makeSlides = (count: number): HeroSlide[] =>
  Array.from({ length: count }, (_, i) => newSlide(i));

// --- INITIAL DATA ---
const INITIAL_BANNERS: Banner[] = [
  {
    id: 'ban-1',
    title: 'M-Pesa STK Push Cashback Hero Slider',
    position: 'Homepage Hero',
    slides: [
      { id: 's-1', imageUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80', headline: 'Save 15% when you pay with M-Pesa', subheadline: 'Limited-time cashback on every STK push checkout', ctaText: 'Shop showcase', ctaLink: '/shop' },
      { id: 's-2', imageUrl: 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=800&q=80', headline: 'Latest 5G smartphones are here', subheadline: 'Trade-in and save up to KES 10,000', ctaText: 'Browse phones', ctaLink: '/categories/smartphones' },
      { id: 's-3', imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80', headline: 'Free delivery nationwide', subheadline: 'On all orders above KES 5,000', ctaText: 'Start shopping', ctaLink: '/shop' },
      { id: 's-4', imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80', headline: 'Ergonomic keyboards', subheadline: 'Boost your productivity today', ctaText: 'Browse keyboards', ctaLink: '/categories/accessories' },
      { id: 's-5', imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80', headline: 'Join 7,800+ shoppers', subheadline: 'Get exclusive weekly deals', ctaText: 'Subscribe now', ctaLink: '/newsletter' },
      { id: 's-6', imageUrl: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?auto=format&fit=crop&w=800&q=80', headline: 'End-of-month clearance', subheadline: 'Up to 40% off on selected items', ctaText: 'Grab deals', ctaLink: '/deals' },
    ],
    startDate: 'Sep 01, 2026',
    endDate: 'Sep 30, 2026',
    active: true,
  },
  {
    id: 'ban-2',
    title: 'Free Shipping Across Kenya Strip',
    position: 'Promo Strip',
    slides: [
      { id: 's-7', imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80', headline: 'Free delivery on orders over KES 5,000', subheadline: 'Nairobi & Mombasa only', ctaText: 'Learn more', ctaLink: '/shipping' },
    ],
    startDate: 'Sep 10, 2026',
    endDate: 'Oct 10, 2026',
    active: true,
  },
  {
    id: 'ban-3',
    title: 'Mechanical Keyboards Category Banner',
    position: 'Category Banner',
    slides: [
      { id: 's-8', imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80', headline: 'Ergonomic & wireless keyboards', subheadline: '', ctaText: 'Browse keyboards', ctaLink: '/categories/accessories' },
    ],
    startDate: 'Aug 15, 2026',
    endDate: 'No end date',
    active: true,
  },
  {
    id: 'ban-4',
    title: 'First-Time Visitor Newsletter Popup',
    position: 'Popup',
    slides: [
      { id: 's-9', imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80', headline: 'Join 7,800+ subscribed shoppers', subheadline: 'Get 10% off your first order', ctaText: 'Claim 10% off', ctaLink: '/newsletter' },
    ],
    startDate: 'Sep 01, 2026',
    endDate: 'Dec 31, 2026',
    active: false,
  },
];

const TABS: BannerTab[] = ['Homepage Hero', 'Promo Strips', 'Category Banners', 'Popups'];
const POSITIONS: BannerPosition[] = ['Homepage Hero', 'Promo Strip', 'Category Banner', 'Popup'];
const HERO_SLIDE_COUNT = 6;

const tabToPosition = (tab: BannerTab): BannerPosition =>
  tab === 'Homepage Hero'
    ? 'Homepage Hero'
    : tab === 'Promo Strips'
    ? 'Promo Strip'
    : tab === 'Category Banners'
    ? 'Category Banner'
    : 'Popup';

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>(INITIAL_BANNERS);
  const [activeTab, setActiveTab] = useState<BannerTab>('Homepage Hero');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentBannerId, setCurrentBannerId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formPosition, setFormPosition] = useState<BannerPosition>('Homepage Hero');
  const [formSlides, setFormSlides] = useState<HeroSlide[]>(makeSlides(HERO_SLIDE_COUNT));
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const [formStartDate, setFormStartDate] = useState('2026-09-23');
  const [formEndDate, setFormEndDate] = useState('2026-10-23');
  const [formNoEndDate, setFormNoEndDate] = useState(false);
  const [formActive, setFormActive] = useState(true);

  const [bannerToDelete, setBannerToDelete] = useState<Banner | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const anyModalOpen = modalOpen || bannerToDelete !== null;

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
        setModalOpen(false);
        setBannerToDelete(null);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [anyModalOpen]);

  const toast = (msg: string) => setToastMessage(msg);

  // When position changes, reset slide count
  useEffect(() => {
    if (!modalOpen) return;
    setFormSlides((prev) => {
      const target = formPosition === 'Homepage Hero' ? HERO_SLIDE_COUNT : 1;
      if (prev.length === target) return prev;
      if (target === 1) return [prev[0] ?? newSlide(0)];
      const next = [...prev];
      for (let i = prev.length; i < target; i++) next.push(newSlide(i));
      return next.slice(0, target);
    });
    setActiveSlideIndex(0);
  }, [formPosition, modalOpen]);

  const updateSlide = (index: number, patch: Partial<HeroSlide>) => {
    setFormSlides((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const handleSlideImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    updateSlide(index, { imageUrl: URL.createObjectURL(file) });
    toast(`Slide ${index + 1} image uploaded`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openAdd = () => {
    setModalMode('add');
    setCurrentBannerId(null);
    setFormTitle('');
    setFormPosition('Homepage Hero');
    setFormSlides(makeSlides(HERO_SLIDE_COUNT));
    setActiveSlideIndex(0);
    setFormStartDate('2026-09-23');
    setFormEndDate('2026-10-23');
    setFormNoEndDate(false);
    setFormActive(true);
    setModalOpen(true);
  };

  const openEdit = (banner: Banner) => {
    setModalMode('edit');
    setCurrentBannerId(banner.id);
    setFormTitle(banner.title);
    setFormPosition(banner.position);

    const target = banner.position === 'Homepage Hero' ? HERO_SLIDE_COUNT : 1;
    const padded = [...banner.slides];
    while (padded.length < target) padded.push(newSlide(padded.length));
    setFormSlides(padded.slice(0, target));
    setActiveSlideIndex(0);
    setFormActive(banner.active);
    setModalOpen(true);
  };

  const saveBanner = () => {
    if (!formTitle.trim()) {
      toast('Banner title is required');
      return;
    }
    const cleanedSlides =
      formPosition === 'Homepage Hero' ? formSlides : [formSlides[0]];

    if (modalMode === 'add') {
      const newBanner: Banner = {
        id: `ban-${Date.now()}`,
        title: formTitle,
        position: formPosition,
        slides: cleanedSlides,
        startDate: 'Today',
        endDate: formNoEndDate ? 'No end date' : 'Oct 23, 2026',
        active: formActive,
      };
      setBanners([newBanner, ...banners]);
      toast('Banner added');
    } else {
      setBanners((prev) =>
        prev.map((b) =>
          b.id === currentBannerId
            ? { ...b, title: formTitle, position: formPosition, slides: cleanedSlides, active: formActive }
            : b
        )
      );
      toast('Banner updated');
    }
    setModalOpen(false);
  };

  const duplicateBanner = (banner: Banner) => {
    const dup: Banner = {
      ...banner,
      id: `ban-${Date.now()}`,
      title: `${banner.title} (copy)`,
      active: false,
      slides: banner.slides.map((s, i) => ({ ...s, id: `slide-${Date.now()}-${i}` })),
    };
    setBanners([dup, ...banners]);
    toast('Duplicated as draft');
  };

  const toggleActive = (id: string) => {
    setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, active: !b.active } : b)));
    toast('Banner status updated');
  };

  const confirmDelete = () => {
    if (!bannerToDelete) return;
    setBanners((prev) => prev.filter((b) => b.id !== bannerToDelete.id));
    setBannerToDelete(null);
    toast('Banner deleted');
  };

  const filtered = banners.filter((b) => b.position === tabToPosition(activeTab));

  const activeSlide = formSlides[activeSlideIndex] ?? formSlides[0];
  const slideCount = formSlides.length;

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
            <h1 className="text-[15px] font-semibold text-slate-900">Banners</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Manage hero sliders, promo strips, category visuals, and popups
            </p>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add banner</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* TABS */}
        <div className="bg-white border border-slate-200 rounded-sm p-0.5 inline-flex gap-0.5">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 rounded-sm text-[13px] font-medium transition ${
                activeTab === tab ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white border border-slate-200 rounded-sm text-[13px] text-slate-400">
              No banners yet. Click "Add banner" to create one.
            </div>
          ) : (
            filtered.map((banner) => {
              const first = banner.slides[0];
              return (
                <div
                  key={banner.id}
                  className="bg-white border border-slate-200 rounded-sm overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-40 w-full bg-slate-100 overflow-hidden">
                      <img
                        src={first.imageUrl}
                        alt={banner.title}
                        className="w-full h-full object-cover"
                      />
                      {banner.slides.length > 1 && (
                        <span className="absolute bottom-2 left-2 bg-slate-900/70 text-white px-2 py-0.5 rounded-sm text-[13px] font-medium backdrop-blur-sm">
                          +{banner.slides.length - 1} slides
                        </span>
                      )}
                      <span
                        className={`absolute top-2 left-2 inline-block px-2 py-0.5 rounded-sm text-[13px] font-medium ${
                          banner.active ? 'bg-emerald-500 text-white' : 'bg-slate-800/80 text-white'
                        }`}
                      >
                        {banner.active ? 'Active' : 'Paused'}
                      </span>
                      <span className="absolute top-2 right-2 bg-slate-900/80 text-white px-2 py-0.5 rounded-sm text-[13px] font-medium backdrop-blur-sm">
                        {banner.position}
                      </span>
                    </div>

                    <div className="p-2 space-y-1">
                      <p className="text-[13px] font-medium text-slate-900 truncate">
                        {banner.title}
                      </p>
                      {first.headline && (
                        <p className="text-[13px] text-blue-950 truncate">{first.headline}</p>
                      )}
                      <p className="text-[13px] text-slate-400 inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {banner.startDate} — {banner.endDate}
                      </p>
                    </div>
                  </div>

                  <div className="px-2 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
                    <button
                      onClick={() => toggleActive(banner.id)}
                      className={`px-2.5 py-2 rounded-sm text-[13px] font-medium transition ${
                        banner.active
                          ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          : 'bg-blue-950 text-white hover:bg-blue-900'
                      }`}
                    >
                      {banner.active ? 'Pause' : 'Activate'}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(banner)}
                        title="Edit"
                        className="p-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => duplicateBanner(banner)}
                        title="Duplicate"
                        className="p-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setBannerToDelete(banner)}
                        title="Delete"
                        className="p-2 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-3xl w-full max-h-[95vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-slate-900 inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-950" />
                  {modalMode === 'add' ? 'Add banner' : 'Edit banner'}
                </h3>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Configure content, image uploads, and schedule
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Banner title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Summer sale promo"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Position</label>
                  <select
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value as BannerPosition)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  >
                    {POSITIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SLIDE TABS */}
              <div className="border border-slate-200 rounded-sm">
                <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-200 bg-slate-50">
                  <p className="text-[13px] font-medium text-slate-700 inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-blue-950" />
                    {formPosition === 'Homepage Hero'
                      ? `Hero slides · ${slideCount}`
                      : 'Banner slide'}
                  </p>
                  <p className="text-[13px] text-slate-400">
                    {formPosition === 'Homepage Hero' ? '1920×600px recommended' : '1200×300px recommended'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1 p-2 border-b border-slate-200">
                  {formSlides.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveSlideIndex(i)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[13px] font-medium transition ${
                        activeSlideIndex === i
                          ? 'bg-blue-950 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          s.imageUrl ? 'bg-emerald-400' : 'bg-slate-400'
                        }`}
                      />
                      Slide {i + 1}
                    </button>
                  ))}
                </div>

                {/* ACTIVE SLIDE EDITOR */}
                <div className="p-2 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
                    {/* Image preview + upload */}
                    <div>
                      <p className="text-[13px] font-medium text-slate-700 mb-1">Background</p>
                      <div className="relative group h-24 rounded-sm bg-slate-100 border border-slate-200 overflow-hidden">
                        <img
                          src={activeSlide.imageUrl}
                          alt={`Slide ${activeSlideIndex + 1}`}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-white text-slate-900 px-2 py-1 rounded-sm text-[13px] font-medium shadow-sm"
                          >
                            Replace
                          </button>
                        </div>
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => handleSlideImageUpload(activeSlideIndex, e)}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>

                    {/* Content fields */}
                    <div className="space-y-2">
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Headline</label>
                        <input
                          type="text"
                          value={activeSlide.headline}
                          onChange={(e) => updateSlide(activeSlideIndex, { headline: e.target.value })}
                          placeholder="e.g. Save 15% on every M-Pesa checkout"
                          className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Subheadline</label>
                        <input
                          type="text"
                          value={activeSlide.subheadline}
                          onChange={(e) => updateSlide(activeSlideIndex, { subheadline: e.target.value })}
                          placeholder="Optional supporting line"
                          className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">CTA text</label>
                      <input
                        type="text"
                        value={activeSlide.ctaText}
                        onChange={(e) => updateSlide(activeSlideIndex, { ctaText: e.target.value })}
                        placeholder="Shop now"
                        className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">CTA link</label>
                      <input
                        type="text"
                        value={activeSlide.ctaLink}
                        onChange={(e) => updateSlide(activeSlideIndex, { ctaLink: e.target.value })}
                        placeholder="/shop"
                        className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
                      />
                    </div>
                  </div>

                  {/* Live preview */}
                  <div>
                    <p className="text-[13px] font-medium text-slate-700 mb-1 inline-flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-blue-950" />
                      Preview · Slide {activeSlideIndex + 1} of {slideCount}
                    </p>
                    <div className="relative rounded-sm overflow-hidden border border-slate-200 h-36 bg-slate-900 text-white flex items-center p-3">
                      <img
                        src={activeSlide.imageUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover opacity-40"
                      />
                      <div className="relative z-10 space-y-1">
                        <span className="inline-block bg-emerald-500 text-white px-1.5 py-0.5 rounded-sm text-[13px] font-medium uppercase tracking-wide">
                          {formPosition}
                        </span>
                        <p className="font-semibold text-[15px]">
                          {activeSlide.headline || 'Slide headline'}
                        </p>
                        {activeSlide.subheadline && (
                          <p className="text-[13px] text-white/80">{activeSlide.subheadline}</p>
                        )}
                        <button className="bg-white text-slate-900 font-medium px-3 py-1 rounded-sm text-[13px]">
                          {activeSlide.ctaText || 'Shop now'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SCHEDULE */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Start date</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">End date</label>
                  <input
                    type="date"
                    disabled={formNoEndDate}
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:bg-slate-50 disabled:opacity-60"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formNoEndDate}
                      onChange={(e) => setFormNoEndDate(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950"
                    />
                    <span className="font-medium text-slate-700">No end date</span>
                  </label>
                </div>
              </div>

              <label className="inline-flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950"
                />
                <span className="font-medium text-slate-700">Enable immediately</span>
              </label>
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setModalOpen(false)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={saveBanner}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                {modalMode === 'add' ? 'Save banner' : 'Update banner'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {bannerToDelete && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setBannerToDelete(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl text-center space-y-3 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-sm bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Delete banner?</h3>
              <p className="text-slate-500 mt-1">
                Remove <span className="font-medium text-slate-800">"{bannerToDelete.title}"</span>?
                All {bannerToDelete.slides.length} slide(s) will be deleted.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => setBannerToDelete(null)}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-sm text-[13px]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
