// lib/store/wishlist.ts
import { create } from 'zustand';
import {
    accountApi,
    type WishlistAddInput,
    type WishlistRow,
    type WishlistStock,
} from '@/lib/api';

const STORAGE_KEY = 'wishlist:v1';

export interface WishlistItem {
    variant_id: string;
    product_id: string;
    product_name: string;
    product_slug?: string;
    product_brand?: string;
    product_image?: string;
    variant_name?: string;
    variant_image?: string;
    unit_price: number;
    compare_at_price?: number | null;
    stock?: WishlistStock;
    stock_count?: number;
    discount_percent?: number;
    rating?: number;
    review_count?: number;
    added_at: number;
    server_id?: number;
}

export type WishlistInput = Omit<WishlistItem, 'added_at' | 'server_id'>;

interface WishlistState {
    items: WishlistItem[];
    _hydrated: boolean;
    _hydrating: boolean;
    _authSnapshot: boolean | null;

    itemCount: () => number;
    has: (variantId: string) => boolean;

    hydrate: (isSignedIn: boolean) => Promise<void>;

    toggle: (
        item: WishlistInput,
        isSignedIn: boolean,
    ) => Promise<{ added: boolean }>;
    remove: (variantId: string, isSignedIn: boolean) => Promise<void>;
    clear: (isSignedIn: boolean) => Promise<void>;
    mergeGuestToServer: () => Promise<void>;
}

const loadFromStorage = (): WishlistItem[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const saveToStorage = (items: WishlistItem[]) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch { }
};

const clearStorage = () => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch { }
};

function fromServer(row: WishlistRow): WishlistItem {
    return {
        server_id: row.id,
        variant_id: row.variant_id,
        product_id: row.product.id,
        product_name: row.product.name,
        product_slug: row.product.slug,
        product_brand: row.product.brand,
        product_image: row.product.image,
        variant_name: row.variant_name,
        variant_image: row.variant_image,
        unit_price: parseFloat(row.unit_price),
        compare_at_price: row.compare_at_price
            ? parseFloat(row.compare_at_price)
            : null,
        stock: row.stock,
        stock_count: row.stock_count,
        discount_percent: row.discount_percent,
        rating: parseFloat(row.product.rating),
        review_count: row.product.review_count,
        added_at: new Date(row.added_at).getTime(),
    };
}

function toServerPayload(item: WishlistInput): WishlistAddInput {
    return {
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: item.product_name,
        product_slug: item.product_slug,
        product_brand: item.product_brand,
        product_image: item.product_image,
        variant_name: item.variant_name,
        variant_image: item.variant_image,
        unit_price: item.unit_price,
        compare_at_price: item.compare_at_price ?? null,
        stock_count: item.stock_count,
        discount_percent: item.discount_percent,
        rating: item.rating,
        review_count: item.review_count,
    };
}

export const useWishlist = create<WishlistState>((set, get) => ({
    items: [],
    _hydrated: false,
    _hydrating: false,
    _authSnapshot: null,

    itemCount: () => get().items.length,

    has: (variantId) =>
        get().items.some((i) => i.variant_id === variantId),

    hydrate: async (isSignedIn) => {
        const { _hydrated, _authSnapshot, _hydrating } = get();

        if (_hydrated && _authSnapshot === isSignedIn) return;
        if (_hydrating) return;

        set({ _hydrating: true });

        try {
            if (isSignedIn) {
                const rows = await accountApi.wishlist.list();
                set({
                    items: rows.map(fromServer),
                    _hydrated: true,
                    _hydrating: false,
                    _authSnapshot: true,
                });
            } else {
                set({
                    items: loadFromStorage(),
                    _hydrated: true,
                    _hydrating: false,
                    _authSnapshot: false,
                });
            }
        } catch {
            set({
                items: [],
                _hydrated: true,
                _hydrating: false,
                _authSnapshot: isSignedIn,
            });
        }
    },

    toggle: async (item, isSignedIn) => {
        const previous = get().items;
        const exists = previous.some(
            (i) => i.variant_id === item.variant_id,
        );

        if (exists) {
            set({
                items: previous.filter(
                    (i) => i.variant_id !== item.variant_id,
                ),
            });
        } else {
            const next: WishlistItem = {
                ...item,
                added_at: Date.now(),
            };
            set({ items: [next, ...previous] });
        }

        try {
            if (isSignedIn) {
                if (exists) {
                    await accountApi.wishlist.removeByVariant(
                        item.variant_id,
                    );
                } else {
                    const row = await accountApi.wishlist.add(
                        toServerPayload(item),
                    );
                    set((state) => ({
                        items: state.items.map((i) =>
                            i.variant_id === item.variant_id
                                ? { ...i, server_id: row.id }
                                : i,
                        ),
                    }));
                }
            } else {
                saveToStorage(get().items);
            }
            return { added: !exists };
        } catch (err) {
            set({ items: previous });
            throw err;
        }
    },

    remove: async (variantId, isSignedIn) => {
        const previous = get().items;
        set({
            items: previous.filter((i) => i.variant_id !== variantId),
        });

        try {
            if (isSignedIn) {
                await accountApi.wishlist.removeByVariant(variantId);
            } else {
                saveToStorage(get().items);
            }
        } catch (err) {
            set({ items: previous });
            throw err;
        }
    },

    clear: async (isSignedIn) => {
        const previous = get().items;
        set({ items: [] });

        try {
            if (isSignedIn) {
                await accountApi.wishlist.clearAll();
            } else {
                clearStorage();
            }
        } catch (err) {
            set({ items: previous });
            throw err;
        }
    },

    mergeGuestToServer: async () => {
        const guest = loadFromStorage();

        if (guest.length === 0) {
            try {
                const rows = await accountApi.wishlist.list();
                set({
                    items: rows.map(fromServer),
                    _hydrated: true,
                    _authSnapshot: true,
                });
            } catch { }
            return;
        }

        try {
            await accountApi.wishlist.bulkAdd(guest.map(toServerPayload));
        } catch {
            return;
        }

        clearStorage();
        try {
            const rows = await accountApi.wishlist.list();
            set({
                items: rows.map(fromServer),
                _hydrated: true,
                _authSnapshot: true,
            });
        } catch { }
    },
}));