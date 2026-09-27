// lib/store/wishlist.ts
import { create } from 'zustand';

export type WishlistItem = {
    variantId: string;
    productId: string;
    name: string;
    brand?: string;
    image: string;
    unitPrice: number;
    compareAtPrice?: number;
    slug: string;
    stockCount?: number;
    stock?: string;
    addedAt: number;
};

const STORAGE_KEY = 'wishlist:v1';

type WishlistState = {
    items: WishlistItem[];
    _hydrated: boolean;
    itemCount: () => number;
    isWishlisted: (variantId: string) => boolean;
    toggleItem: (item: Omit<WishlistItem, 'addedAt'>) => void;
    addItem: (item: Omit<WishlistItem, 'addedAt'>) => void;
    removeItem: (variantId: string) => void;
    clear: () => void;
    hydrate: () => void;
};

const loadFromStorage = (): WishlistItem[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

const saveToStorage = (items: WishlistItem[]) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
        /* ignore quota errors */
    }
};

export const useWishlist = create<WishlistState>((set, get) => ({
    // Always start empty on both server and client — hydration happens in an effect
    items: [],
    _hydrated: false,

    itemCount: () => get().items.length,

    isWishlisted: (variantId) =>
        get().items.some((i) => i.variantId === variantId),

    addItem: (item) => {
        set((state) => {
            if (state.items.some((i) => i.variantId === item.variantId)) return state;
            const next = [{ ...item, addedAt: Date.now() }, ...state.items];
            saveToStorage(next);
            return { items: next };
        });
    },

    removeItem: (variantId) => {
        set((state) => {
            const next = state.items.filter((i) => i.variantId !== variantId);
            saveToStorage(next);
            return { items: next };
        });
    },

    toggleItem: (item) => {
        const exists = get().items.some((i) => i.variantId === item.variantId);
        if (exists) get().removeItem(item.variantId);
        else get().addItem(item);
    },

    clear: () => {
        saveToStorage([]);
        set({ items: [] });
    },

    hydrate: () => {
        if (get()._hydrated) return;
        const items = loadFromStorage();
        set({ items, _hydrated: true });
    },
}));