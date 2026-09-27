// data/discounts.ts

export type DiscountStatus = 'Active' | 'Scheduled' | 'Expired';

export type DiscountType =
    | 'Percentage'
    | 'Fixed Amount'
    | 'Free Shipping'
    | 'Buy X Get Y';

export type PromotionType =
    | 'Percentage Discount'
    | 'Fixed Amount Discount'
    | 'Sale Price'
    | 'Campaign';

export type AppliesTo =
    | 'All Products'
    | 'Specific Products'
    | 'Specific Categories';

export interface Discount {
    id: string;
    code: string;
    description: string;
    type: DiscountType;
    value: string;
    minOrder: number;
    maxCap: number;
    usageLimit: number;
    perCustomer: number;
    usageCount: number;
    startDate: string;
    endDate: string;
    status: DiscountStatus;
    appliesTo: AppliesTo;
    eligibility: string;
    targetAudience: string;
    isMostDeal: boolean;
    image: string;

    // Storefront presentation
    displayOnDealsPage: boolean;
    promotionType: PromotionType;
    dealTitle: string;
    badgeText: string;
    priority: number;
    linkedProductIds: string[];
    linkedCategories: string[];
}

/**
 * Seed discount catalogue — the very first time the admin store hydrates,
 * these are used as the starting list. After that, localStorage takes over.
 *
 * Every `linkedProductIds` entry below points at a real id in
 * `data/products.ts`, and every `image` is one of the product images
 * from the same catalogue, so the deals page renders real cards.
 */
export const discounts: Discount[] = [
    // ── 1. TV & Home Entertainment Week ──────────────────────────────
    {
        id: 'disc_tv_week',
        code: 'TVWEEK15',
        description: '15% off all Smart TVs and home entertainment displays',
        type: 'Percentage',
        value: '15%',
        minOrder: 30000,
        maxCap: 0,
        usageLimit: 300,
        perCustomer: 1,
        usageCount: 47,
        startDate: '2026-09-20 00:00',
        endDate: '2026-12-31 23:59',
        status: 'Active',
        appliesTo: 'Specific Categories',
        eligibility: 'All Customers',
        targetAudience: 'All People & Customers',
        isMostDeal: true,
        image: '/tvs.jpeg',
        displayOnDealsPage: true,
        promotionType: 'Percentage Discount',
        dealTitle: 'TV & Home Entertainment Week',
        badgeText: '15% OFF',
        priority: 10,
        linkedProductIds: [],
        linkedCategories: ['TVs'],
    },

    // ── 2. Laptop Power Days ─────────────────────────────────────────
    {
        id: 'disc_laptop_power',
        code: 'LAPTOP20',
        description: '20% off premium workstations and ultrabooks',
        type: 'Percentage',
        value: '20%',
        minOrder: 50000,
        maxCap: 0,
        usageLimit: 150,
        perCustomer: 1,
        usageCount: 23,
        startDate: '2026-09-25 00:00',
        endDate: '2026-11-15 23:59',
        status: 'Active',
        appliesTo: 'Specific Products',
        eligibility: 'All Customers',
        targetAudience: 'All People & Customers',
        isMostDeal: true,
        image: '/macbook.jpeg',
        displayOnDealsPage: true,
        promotionType: 'Percentage Discount',
        dealTitle: 'Laptop Power Days',
        badgeText: '20% OFF',
        priority: 9,
        linkedProductIds: [
            'prod_39xka1',
            'prd_new_01',
            'prd_new_08',
        ],
        linkedCategories: [],
    },

    // ── 3. Audio Blowout ─────────────────────────────────────────────
    {
        id: 'disc_audio_blowout',
        code: 'AUDIO25',
        description: '25% off premium headphones and portable speakers',
        type: 'Percentage',
        value: '25%',
        minOrder: 15000,
        maxCap: 0,
        usageLimit: 200,
        perCustomer: 2,
        usageCount: 68,
        startDate: '2026-09-15 00:00',
        endDate: '2026-12-15 23:59',
        status: 'Active',
        appliesTo: 'Specific Products',
        eligibility: 'All Customers',
        targetAudience: 'All People & Customers',
        isMostDeal: true,
        image: '/Headphone.jpeg',
        displayOnDealsPage: true,
        promotionType: 'Percentage Discount',
        dealTitle: 'Audio Blowout',
        badgeText: '25% OFF',
        priority: 8,
        linkedProductIds: [
            'prod_72ndbc',
            'prod_66plmw',
            'prd_new_05',
        ],
        linkedCategories: [],
    },

    // ── 4. Phone & Mobile Deals ──────────────────────────────────────
    {
        id: 'disc_phone_deals',
        code: 'PHONE10',
        description: '10% off flagship smartphones and mobile accessories',
        type: 'Percentage',
        value: '10%',
        minOrder: 30000,
        maxCap: 0,
        usageLimit: 400,
        perCustomer: 1,
        usageCount: 91,
        startDate: '2026-09-10 00:00',
        endDate: '2026-10-20 23:59',
        status: 'Active',
        appliesTo: 'Specific Products',
        eligibility: 'All Customers',
        targetAudience: 'All People & Customers',
        isMostDeal: true,
        image: '/phone.jpeg',
        displayOnDealsPage: true,
        promotionType: 'Percentage Discount',
        dealTitle: 'Phone & Mobile Deals',
        badgeText: '10% OFF',
        priority: 7,
        linkedProductIds: [
            'prod_91klas',
            'prd_new_02',
        ],
        linkedCategories: [],
    },

    // ── 5. Gaming Accessories Deal ───────────────────────────────────
    {
        id: 'disc_gaming_gear',
        code: 'GAME15',
        description: '15% off gaming controllers and accessories',
        type: 'Percentage',
        value: '15%',
        minOrder: 8000,
        maxCap: 0,
        usageLimit: 250,
        perCustomer: 2,
        usageCount: 34,
        startDate: '2026-09-22 00:00',
        endDate: '2026-12-05 23:59',
        status: 'Active',
        appliesTo: 'Specific Products',
        eligibility: 'All Customers',
        targetAudience: 'All People & Customers',
        isMostDeal: false,
        image: '/gamecontroller.jpeg',
        displayOnDealsPage: true,
        promotionType: 'Percentage Discount',
        dealTitle: 'Gaming Gear Savings',
        badgeText: '15% OFF',
        priority: 6,
        linkedProductIds: ['prod_54gmrx'],
        linkedCategories: [],
    },

    // ── 6. Welcome Voucher (all products) ────────────────────────────
    {
        id: 'disc_welcome',
        code: 'WELCOME500',
        description: 'New buyer welcome voucher — KES 500 off your first order',
        type: 'Fixed Amount',
        value: 'KES 500',
        minOrder: 2000,
        maxCap: 500,
        usageLimit: 1000,
        perCustomer: 1,
        usageCount: 89,
        startDate: '2026-01-01 00:00',
        endDate: '2026-12-31 23:59',
        status: 'Active',
        appliesTo: 'All Products',
        eligibility: 'First-time Buyers',
        targetAudience: 'All People & Customers',
        isMostDeal: false,
        image: '/Router.jpeg',
        displayOnDealsPage: true,
        promotionType: 'Fixed Amount Discount',
        dealTitle: 'Welcome Offer',
        badgeText: 'KES 500 OFF',
        priority: 5,
        linkedProductIds: [],
        linkedCategories: [],
    },

    // ── 7. Networking Essentials ─────────────────────────────────────
    {
        id: 'disc_networking',
        code: 'NETGEAR12',
        description: '12% off routers and networking equipment',
        type: 'Percentage',
        value: '12%',
        minOrder: 8000,
        maxCap: 0,
        usageLimit: 180,
        perCustomer: 1,
        usageCount: 15,
        startDate: '2026-09-18 00:00',
        endDate: '2026-11-30 23:59',
        status: 'Active',
        appliesTo: 'Specific Products',
        eligibility: 'All Customers',
        targetAudience: 'All People & Customers',
        isMostDeal: false,
        image: '/Router.jpeg',
        displayOnDealsPage: true,
        promotionType: 'Percentage Discount',
        dealTitle: 'Networking Essentials',
        badgeText: '12% OFF',
        priority: 4,
        linkedProductIds: ['prod_21tpac'],
        linkedCategories: [],
    },

    // ── 8. Wearables & Smart Accessories ─────────────────────────────
    {
        id: 'disc_wearables',
        code: 'WEAR20',
        description: '20% off fitness trackers and wearable tech',
        type: 'Percentage',
        value: '20%',
        minOrder: 4000,
        maxCap: 0,
        usageLimit: 300,
        perCustomer: 2,
        usageCount: 52,
        startDate: '2026-09-12 00:00',
        endDate: '2026-11-20 23:59',
        status: 'Active',
        appliesTo: 'Specific Products',
        eligibility: 'All Customers',
        targetAudience: 'All People & Customers',
        isMostDeal: false,
        image: '/xiaomiwatch.jpeg',
        displayOnDealsPage: true,
        promotionType: 'Percentage Discount',
        dealTitle: 'Wearables Week',
        badgeText: '20% OFF',
        priority: 3,
        linkedProductIds: ['prod_88smrt'],
        linkedCategories: [],
    },

    // ── 9. Scheduled — Heritage Day ──────────────────────────────────
    {
        id: 'disc_heritage',
        code: 'HERITAGEDAY2026',
        description: 'Scheduled national holiday promotion across select categories',
        type: 'Percentage',
        value: '20%',
        minOrder: 10000,
        maxCap: 0,
        usageLimit: 200,
        perCustomer: 1,
        usageCount: 0,
        startDate: '2026-10-20 00:00',
        endDate: '2026-10-22 23:59',
        status: 'Scheduled',
        appliesTo: 'Specific Categories',
        eligibility: 'All Customers',
        targetAudience: 'All People & Customers',
        isMostDeal: false,
        image: '/smartphone2.jpeg',
        displayOnDealsPage: true,
        promotionType: 'Percentage Discount',
        dealTitle: 'Heritage Day Sale',
        badgeText: '20% OFF',
        priority: 2,
        linkedProductIds: [],
        linkedCategories: ['Phones', 'Audio'],
    },

    // ── 10. Free shipping (hidden from deals page) ───────────────────
    {
        id: 'disc_freeship',
        code: 'FREESHIPNAIROBI',
        description: 'Free doorstep delivery for regional orders over KES 3,500',
        type: 'Free Shipping',
        value: '100% Off',
        minOrder: 3500,
        maxCap: 0,
        usageLimit: 500,
        perCustomer: 1,
        usageCount: 310,
        startDate: '2026-09-01 00:00',
        endDate: '2026-12-30 23:59',
        status: 'Active',
        appliesTo: 'All Products',
        eligibility: 'All Customers',
        targetAudience: 'All People & Customers',
        isMostDeal: false,
        image: '/powerstation.jpeg',
        displayOnDealsPage: false,
        promotionType: 'Campaign',
        dealTitle: '',
        badgeText: 'FREE SHIP',
        priority: 1,
        linkedProductIds: [],
        linkedCategories: [],
    },

    // ── 11. Expired — Summer clearance ───────────────────────────────
    {
        id: 'disc_summer',
        code: 'SUMMERBLOWOUT',
        description: 'Expired seasonal clearance on portable audio',
        type: 'Percentage',
        value: '30%',
        minOrder: 15000,
        maxCap: 0,
        usageLimit: 450,
        perCustomer: 1,
        usageCount: 450,
        startDate: '2026-06-01 00:00',
        endDate: '2026-08-31 23:59',
        status: 'Expired',
        appliesTo: 'Specific Products',
        eligibility: 'All Customers',
        targetAudience: 'All People & Customers',
        isMostDeal: false,
        image: '/jbl.jpeg',
        displayOnDealsPage: false,
        promotionType: 'Percentage Discount',
        dealTitle: '',
        badgeText: '30% OFF',
        priority: 0,
        linkedProductIds: ['prod_66plmw'],
        linkedCategories: [],
    },
];

// ─────────────────────────────────────────────────────────────
// Helpers — pure functions, no React, no store
// ─────────────────────────────────────────────────────────────

/**
 * Derive Active / Scheduled / Expired from the dates.
 * Called on every read so admin-set dates always win.
 */
export function computeStatus(
    startDate: string,
    endDate: string
): DiscountStatus {
    const now = Date.now();
    const s = startDate ? new Date(startDate.replace(' ', 'T')).getTime() : 0;
    const e = endDate ? new Date(endDate.replace(' ', 'T')).getTime() : 0;
    if (!s || !e) return 'Scheduled';
    if (now < s) return 'Scheduled';
    if (now > e) return 'Expired';
    return 'Active';
}

/** Numeric value extracted from strings like "15%" or "KES 500". */
export function numericDiscountValue(d: Discount): number {
    const n = parseFloat(d.value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : 0;
}

/** The price a customer pays for a product under a given discount. */
export function discountedPrice(d: Discount, originalPrice: number): number {
    const n = numericDiscountValue(d);
    if (d.type === 'Percentage') {
        return Math.max(0, Math.round(originalPrice * (1 - n / 100)));
    }
    if (d.type === 'Fixed Amount') {
        return Math.max(0, originalPrice - n);
    }
    return originalPrice;
}

/** The percent-off shown on a deal badge. */
export function discountPercent(d: Discount, originalPrice: number): number {
    if (originalPrice <= 0) return 0;
    const final = discountedPrice(d, originalPrice);
    return Math.round(((originalPrice - final) / originalPrice) * 100);
}