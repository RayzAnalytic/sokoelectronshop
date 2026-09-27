// lib/store/discounts.ts
import { create } from 'zustand';

export type DiscountStatus = 'Active' | 'Scheduled' | 'Expired';
export type DiscountType = 'Percentage' | 'Fixed Amount' | 'Free Shipping' | 'Buy X Get Y';
export type PromotionType =
    | 'Percentage Discount'
    | 'Fixed Amount Discount'
    | 'Sale Price'
    | 'Campaign';
export type AppliesTo = 'All Products' | 'Specific Products' | 'Specific Categories';

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

const STORAGE_KEY = 'admin:discounts:v1';

// ─── Seed data used the very first time ───
const SEED: Omit<Discount, 'id'>[] = [
    {
        code: 'SOKOWEEKEND15',
        description: 'Weekend flash sale across the storefront',
        type: 'Percentage',
        value: '15%',
        minOrder: 5000,
        maxCap: 0,
        usageLimit: 500,
        perCustomer: 1,
        usageCount: 142,
        startDate: '2026-09-20 00:00',
        endDate: '2026-09-27 23:59',
        status: 'Active',
        appliesTo: 'All Products',
        eligibility: 'All Customers',
        targetAudience: 'All People & Customers',
        isMostDeal: true,
        image:
            'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=100&auto=format&fit=crop&q=80',
        displayOnDealsPage: true,
        promotionType: 'Percentage Discount',
        dealTitle: 'Weekend Flash Sale',
        badgeText: '15% OFF',
        priority: 10,
        linkedProductIds: [],
        linkedCategories: [],
    },
    {
        code: 'WELCOME500',
        description: 'New buyer welcome voucher',
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
        isMostDeal: true,
        image:
            'https://images.unsplash.com/photo-1607346256330-dee7af15f7c5?w=100&auto=format&fit=crop&q=80',
        displayOnDealsPage: true,
        promotionType: 'Fixed Amount Discount',
        dealTitle: 'Welcome Offer',
        badgeText: 'KES 500 OFF',
        priority: 8,
        linkedProductIds: [],
        linkedCategories: [],
    },
    {
        code: 'FREESHIPNAIROBI',
        description: 'Free doorstep delivery for regional orders',
        type: 'Free Shipping',
        value: '100% Off',
        minOrder: 3500,
        maxCap: 0,
        usageLimit: 500,
        perCustomer: 1,
        usageCount: 310,
        startDate: '2026-09-01 00:00',
        endDate: '2026-09-30 23:59',
        status: 'Active',
        appliesTo: 'All Products',
        eligibility: 'All Customers',
        targetAudience: 'All People & Customers',
        isMostDeal: false,
        image:
            'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=100&auto=format&fit=crop&q=80',
        displayOnDealsPage: false,
        promotionType: 'Campaign',
        dealTitle: '',
        badgeText: 'FREE SHIP',
        priority: 3,
        linkedProductIds: [],
        linkedCategories: [],
    },
    {
        code: 'HERITAGEDAY2026',
        description: 'Scheduled national holiday promotion',
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
        image:
            'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&auto=format&fit=crop&q=80',
        displayOnDealsPage: true,
        promotionType: 'Percentage Discount',
        dealTitle: 'Heritage Day Sale',
        badgeText: '20% OFF',
        priority: 5,
        linkedProductIds: [],
        linkedCategories: ['Phones', 'Audio'],
    },
    {
        code: 'SUMMERBLOWOUT',
        description: 'Expired seasonal clearance',
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
        appliesTo: 'All Products',
        eligibility: 'All Customers',
        targetAudience: 'All People & Customers',
        isMostDeal: false,
        image:
            'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100&auto=format&fit=crop&q=80',
        displayOnDealsPage: false,
        promotionType: 'Percentage Discount',
        dealTitle: '',
        badgeText: '30% OFF',
        priority: 0,
        linkedProductIds: [],
        linkedCategories: [],
    },
];

const genId = () =>
    `disc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

/**
 * Recompute a discount's status from its dates.
 * Called before every save so admin-set dates always win.
 */
export const computeStatus = (
    startDate: string,
    endDate: string
): DiscountStatus => {
    const now = Date.now();
    const s = startDate ? new Date(startDate.replace(' ', 'T')).getTime() : 0;
    const e = endDate ? new Date(endDate.replace(' ', 'T')).getTime() : 0;
    if (!s || !e) return 'Scheduled';
    if (now < s) return 'Scheduled';
    if (now > e) return 'Expired';
    return 'Active';
};

const seedWithIds = (): Discount[] =>
    SEED.map((d) => ({ ...d, id: genId() }));

const load = (): Discount[] => {
    if (typeof window === 'undefined') return seedWithIds();
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return seedWithIds();
        const parsed = JSON.parse(raw) as Discount[];
        // Refresh statuses on load so expired deals reflect reality
        return parsed.map((d) => ({
            ...d,
            status: computeStatus(d.startDate, d.endDate),
        }));
    } catch {
        return seedWithIds();
    }
};

const save = (items: Discount[]) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
        /* ignore quota */
    }
};

export type DiscountPayload = Omit<Discount, 'id' | 'usageCount'> & {
    id?: string;
};

type DiscountsState = {
    items: Discount[];
    _hydrated: boolean;

    hydrate: () => void;
    getAll: () => Discount[];
    getById: (id: string) => Discount | undefined;
    addDiscount: (payload: DiscountPayload) => Discount;
    updateDiscount: (id: string, payload: DiscountPayload) => void;
    removeDiscount: (id: string) => void;
    removeMany: (ids: string[]) => void;
    duplicateDiscount: (id: string) => Discount | undefined;
    toggleMostDeal: (id: string) => void;
};

export const useDiscounts = create<DiscountsState>((set, get) => ({
    items: [],
    _hydrated: false,

    hydrate: () => {
        if (get()._hydrated) return;
        const items = load();
        save(items);
        set({ items, _hydrated: true });
    },

    getAll: () => get().items,

    getById: (id) => get().items.find((d) => d.id === id),

    addDiscount: (payload) => {
        const full: Discount = {
            ...payload,
            id: genId(),
            usageCount: 0,
            status: computeStatus(payload.startDate, payload.endDate),
            code: payload.code.toUpperCase(),
        } as Discount;
        const next = [full, ...get().items];
        save(next);
        set({ items: next });
        return full;
    },

    updateDiscount: (id, payload) => {
        const next = get().items.map((d) =>
            d.id === id
                ? {
                    ...d,
                    ...payload,
                    id,
                    code: payload.code.toUpperCase(),
                    status: computeStatus(payload.startDate, payload.endDate),
                }
                : d
        );
        save(next);
        set({ items: next });
    },

    removeDiscount: (id) => {
        const next = get().items.filter((d) => d.id !== id);
        save(next);
        set({ items: next });
    },

    removeMany: (ids) => {
        const idSet = new Set(ids);
        const next = get().items.filter((d) => !idSet.has(d.id));
        save(next);
        set({ items: next });
    },

    duplicateDiscount: (id) => {
        const src = get().items.find((d) => d.id === id);
        if (!src) return undefined;
        const dup: Discount = {
            ...src,
            id: genId(),
            code: `${src.code}_COPY`,
            usageCount: 0,
            status: 'Scheduled',
        };
        const next = [dup, ...get().items];
        save(next);
        set({ items: next });
        return dup;
    },

    toggleMostDeal: (id) => {
        const next = get().items.map((d) =>
            d.id === id ? { ...d, isMostDeal: !d.isMostDeal } : d
        );
        save(next);
        set({ items: next });
    },
}));