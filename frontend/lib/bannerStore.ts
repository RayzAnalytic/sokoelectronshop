// lib/bannerStore.ts

export type Placement = 'HOME_HERO' | 'CATEGORY_HERO' | 'PROMO_STRIP';
export type Status = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED';
export type Alignment = 'LEFT' | 'CENTER' | 'RIGHT';
export type Overlay = 'NONE' | 'DARK' | 'LIGHT' | 'GRADIENT';

export interface Banner {
    id: number;
    name: string;
    placement: Placement;
    order: number;

    badge: string;
    headline: string;
    description: string;

    desktop_image: string;
    tablet_image: string;
    mobile_image: string;

    primary_cta_text: string;
    primary_cta_href: string;
    secondary_cta_text: string;
    secondary_cta_href: string;

    text_alignment: Alignment;
    overlay_style: Overlay;
    overlay_opacity: number;

    status: Status;
    start_at: string;
    end_at: string;

    impressions: number;
    clicks: number;
    conversions: number;

    updated_at: string;
}

const KEY = 'myshop.banners.v1';

/**
 * Your six current slides, converted to the Banner shape.
 * These are what the admin and the hero both see until someone edits them.
 */
export const SEED_BANNERS: Banner[] = [
    {
        id: 1,
        name: 'Featured Collection',
        placement: 'HOME_HERO',
        order: 1,
        badge: 'Featured Collection • New Season',
        headline: 'Top Picks Across Every Category.',
        description:
            'Handpicked electronics from the brands customers trust most — smartphones, laptops, audio, and accessories, all in stock and ready to ship.',
        desktop_image: '/hero01.png',
        tablet_image: '',
        mobile_image: '',
        primary_cta_text: 'Shop Collection',
        primary_cta_href: '/pages/products',
        secondary_cta_text: 'Best Sellers',
        secondary_cta_href: '/pages/products/bestsellingproducts',
        text_alignment: 'LEFT',
        overlay_style: 'GRADIENT',
        overlay_opacity: 80,
        status: 'ACTIVE',
        start_at: '',
        end_at: '',
        impressions: 12480,
        clicks: 892,
        conversions: 74,
        updated_at: '2026-09-25T14:20:00Z',
    },
    {
        id: 2,
        name: 'Visit Our Store — Westlands',
        placement: 'HOME_HERO',
        order: 2,
        badge: 'Visit Our Store • Westlands Nairobi',
        headline: 'Experience Tech In Person.',
        description:
            'Walk in, try before you buy, and get help from our team in minutes. Two locations open 7 days a week.',
        desktop_image: '/hero02.png',
        tablet_image: '',
        mobile_image: '',
        primary_cta_text: 'Find A Store',
        primary_cta_href: '/stores',
        secondary_cta_text: 'Talk To Us',
        secondary_cta_href: '/support',
        text_alignment: 'LEFT',
        overlay_style: 'GRADIENT',
        overlay_opacity: 80,
        status: 'ACTIVE',
        start_at: '',
        end_at: '',
        impressions: 20110,
        clicks: 1432,
        conversions: 96,
        updated_at: '2026-09-28T10:05:00Z',
    },
    {
        id: 3,
        name: 'Smart Appliances',
        placement: 'HOME_HERO',
        order: 3,
        badge: 'Modern Living • Smart Appliances',
        headline: 'Smart Appliances For Modern Homes.',
        description:
            'Fridges, power stations, and connected devices engineered for reliability — even when the grid is not.',
        desktop_image: '/hero03.png',
        tablet_image: '',
        mobile_image: '',
        primary_cta_text: 'Shop Smart Home',
        primary_cta_href: '/pages/products',
        secondary_cta_text: 'View Power Stations',
        secondary_cta_href: '/pages/products',
        text_alignment: 'LEFT',
        overlay_style: 'GRADIENT',
        overlay_opacity: 80,
        status: 'ACTIVE',
        start_at: '',
        end_at: '',
        impressions: 9810,
        clicks: 640,
        conversions: 51,
        updated_at: '2026-09-24T09:12:00Z',
    },
    {
        id: 4,
        name: 'Top Rated This Month',
        placement: 'HOME_HERO',
        order: 4,
        badge: 'Customer Favorites • Top Rated',
        headline: 'The Best Products This Month.',
        description:
            'Ranked by real customer reviews. Nothing under 4.6 stars makes this list.',
        desktop_image: '/hero04.png',
        tablet_image: '',
        mobile_image: '',
        primary_cta_text: 'Shop Best Sellers',
        primary_cta_href: '/pages/products/bestsellingproducts',
        secondary_cta_text: 'Read Reviews',
        secondary_cta_href: '/pages/products',
        text_alignment: 'LEFT',
        overlay_style: 'GRADIENT',
        overlay_opacity: 80,
        status: 'ACTIVE',
        start_at: '',
        end_at: '',
        impressions: 15220,
        clicks: 1105,
        conversions: 88,
        updated_at: '2026-09-26T11:40:00Z',
    },
    {
        id: 5,
        name: 'New Arrivals',
        placement: 'HOME_HERO',
        order: 5,
        badge: 'Just Landed • New Arrivals',
        headline: 'New Products, Straight Off The Truck.',
        description:
            'The latest gear added this month — from M4 MacBooks to next-gen controllers. First come, first served.',
        desktop_image: '/hero05.png',
        tablet_image: '',
        mobile_image: '',
        primary_cta_text: 'Shop New Arrivals',
        primary_cta_href: '/pages/products/newarrivals',
        secondary_cta_text: 'Special Deals',
        secondary_cta_href: '/pages/products/specialdeals',
        text_alignment: 'LEFT',
        overlay_style: 'GRADIENT',
        overlay_opacity: 80,
        status: 'ACTIVE',
        start_at: '',
        end_at: '',
        impressions: 11020,
        clicks: 830,
        conversions: 63,
        updated_at: '2026-09-27T16:00:00Z',
    },
    {
        id: 6,
        name: 'Browse By Category',
        placement: 'HOME_HERO',
        order: 6,
        badge: 'Browse By Category',
        headline: 'Find Exactly What You Need.',
        description:
            'Every product organized into clear categories — no endless scrolling, no guesswork.',
        desktop_image: '/hero06.png',
        tablet_image: '',
        mobile_image: '',
        primary_cta_text: 'View All Categories',
        primary_cta_href: '/pages/categories',
        secondary_cta_text: 'Shop All',
        secondary_cta_href: '/pages/products',
        text_alignment: 'LEFT',
        overlay_style: 'GRADIENT',
        overlay_opacity: 80,
        status: 'ACTIVE',
        start_at: '',
        end_at: '',
        impressions: 8760,
        clicks: 512,
        conversions: 39,
        updated_at: '2026-09-23T08:30:00Z',
    },
];

// ── Storage ──────────────────────────────────────────────────────────────────

export function loadBanners(): Banner[] {
    if (typeof window === 'undefined') return SEED_BANNERS;
    try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return SEED_BANNERS;
        const parsed = JSON.parse(raw) as Banner[];
        return Array.isArray(parsed) && parsed.length ? parsed : SEED_BANNERS;
    } catch {
        return SEED_BANNERS;
    }
}

export function saveBanners(banners: Banner[]) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(KEY, JSON.stringify(banners));
    } catch (e) {
        console.warn('[bannerStore] save failed — storage may be full', e);
        alert(
            'Could not save: browser storage is full. Try smaller images or remove older banners.',
        );
    }
}

export function resetBanners() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(KEY);
}

// ── Selectors ────────────────────────────────────────────────────────────────

/**
 * What the homepage hero should show right now:
 *   - placement = HOME_HERO
 *   - status    = ACTIVE
 *   - within start/end window (if set)
 *   - sorted by `order`
 */
export function activeHeroSlides(): Banner[] {
    const now = Date.now();
    return loadBanners()
        .filter((b) => b.placement === 'HOME_HERO' && b.status === 'ACTIVE')
        .filter((b) => {
            if (b.start_at && new Date(b.start_at).getTime() > now) return false;
            if (b.end_at && new Date(b.end_at).getTime() <= now) return false;
            return true;
        })
        .sort((a, b) => a.order - b.order);
}

// ── Derived metrics ──────────────────────────────────────────────────────────

export function ctr(b: Banner) {
    return b.impressions ? (b.clicks / b.impressions) * 100 : 0;
}
export function cvr(b: Banner) {
    return b.clicks ? (b.conversions / b.clicks) * 100 : 0;
}
export function fmt(n: number) {
    return n.toLocaleString('en-KE');
}
export function fmtDate(iso: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-KE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}