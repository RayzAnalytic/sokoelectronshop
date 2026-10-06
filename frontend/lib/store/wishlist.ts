// lib/store/wishlist.ts
import { create } from 'zustand';
import {
    accountApi,
    type WishlistAddInput,
    type WishlistRow,
    type WishlistStock,
} from '@/lib/api';

const STORAGE_KEY = 'wishlist:v1';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
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
    /** Row id from the server. Undefined for guest items that haven't
     *  synced yet. Used as a fallback for delete if by-variant fails. */
    server_id?: number;
}

/** Input shape for `toggle` — the caller passes everything except
 *  the fields the store assigns (`added_at`, `server_id`). */
export type WishlistInput = Omit<WishlistItem, 'added_at' | 'server_id'>;

interface WishlistState {
    items: WishlistItem[];
    /** True once hydrate() has run at least once for the current auth state. */
    _hydrated: boolean;
    /** True while a hydrate call is in flight — prevents concurrent fetches. */
    _hydrating: boolean;
    /** What auth state the current items reflect. Null = not yet hydrated. */
    _authSnapshot: boolean | null;

    // ── Reads ──
    itemCount: () => number;
    has: (variantId: string) => boolean;

    // ── Lifecycle ──
    /** Populate from the correct source. Idempotent per auth state. */
    hydrate: (isSignedIn: boolean) => Promise<void>;

    // ── Mutations ──
    /** Toggle add/remove. Optimistic; rolls back on failure. */
    toggle: (
        item: WishlistInput,
        isSignedIn: boolean,
    ) => Promise<{ added: boolean }>;
    /** Explicit remove (used by the wishlist page). Optimistic. */
    remove: (variantId: string, isSignedIn: boolean) => Promise<void>;
    /** Remove everything. Optimistic. */
    clear: (isSignedIn: boolean) => Promise<void>;
    /** Called after login/register — pushes localStorage items to the
     *  server and re-hydrates. */
    mergeGuestToServer: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// localStorage helpers — guest wishlist storage
// ─────────────────────────────────────────────────────────────────────────────
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
    } catch {
        /* quota exceeded — ignore */
    }
};

const clearStorage = () => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch {
        /* ignore */
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Server <-> store translations
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Server rows have a nested `product` object; the store keeps
 * everything flat so consumers can read fields directly without
 * `item.product.` prefixes.
 */
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

/** Flattened store shape → the wire format the backend expects. */
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
        stock: item.stock,
        stock_count: item.stock_count,
        discount_percent: item.discount_percent,
        rating: item.rating,
        review_count: item.review_count,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────
export const useWishlist = create<WishlistState>((set, get) => ({
    items: [],
    _hydrated: false,
    _hydrating: false,
    _authSnapshot: null,

    // ── Reads ──────────────────────────────────────────────────────────
    itemCount: () => get().items.length,

    has: (variantId) =>
        get().items.some((i) => i.variant_id === variantId),

    // ── Hydrate ────────────────────────────────────────────────────────
    hydrate: async (isSignedIn) => {
        const { _hydrated, _authSnapshot, _hydrating } = get();

        // Skip if already hydrated for this auth state.
        if (_hydrated && _authSnapshot === isSignedIn) return;
        // Skip if another hydrate is already in flight. The next
        // effect tick will re-run once `_hydrating` clears.
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
            // Network blip or 401 — surface an empty wishlist rather
            // than a stale one. The next hydrate attempt will retry.
            set({
                items: [],
                _hydrated: true,
                _hydrating: false,
                _authSnapshot: isSignedIn,
            });
        }
    },

    // ── Toggle ─────────────────────────────────────────────────────────
    toggle: async (item, isSignedIn) => {
        const previous = get().items;
        const exists = previous.some(
            (i) => i.variant_id === item.variant_id,
        );

        // Optimistic update — the icon flips immediately.
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
                    // Attach the server id so a later delete-by-id
                    // path can use it if needed.
                    set((state) => ({
                        items: state.items.map((i) =>
                            i.variant_id === item.variant_id
                                ? { ...i, server_id: row.id }
                                : i,
                        ),
                    }));
                }
            } else {
                // Guest — persist to localStorage.
                saveToStorage(get().items);
            }
            return { added: !exists };
        } catch (err) {
            // Rollback on any failure.
            set({ items: previous });
            throw err;
        }
    },

    // ── Remove ─────────────────────────────────────────────────────────
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

    // ── Clear all ──────────────────────────────────────────────────────
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

    // ── Guest → server merge ───────────────────────────────────────────
    /**
     * Called once after the customer signs in. Reads localStorage,
     * pushes every item to the server in one request, clears the guest
     * copy, and re-hydrates from the server so state matches exactly.
     *
     * Safe to call multiple times — the backend's bulk-add is
     * idempotent, so a repeat call after a partial failure just
     * re-attempts the missing items.
     */
    mergeGuestToServer: async () => {
        const guest = loadFromStorage();

        // No guest items — just refresh from the server.
        if (guest.length === 0) {
            try {
                const rows = await accountApi.wishlist.list();
                set({
                    items: rows.map(fromServer),
                    _hydrated: true,
                    _authSnapshot: true,
                });
            } catch {
                /* keep current state on network failure */
            }
            return;
        }

        try {
            await accountApi.wishlist.bulkAdd(guest.map(toServerPayload));
        } catch {
            // Merge failed — leave localStorage intact so we can retry
            // on the next sign-in. Don't clear.
            return;
        }

        // Success — drop the guest copy and re-hydrate from the server
        // so the store's item list matches exactly what the backend
        // now holds (including any items already on the account).
        clearStorage();
        try {
            const rows = await accountApi.wishlist.list();
            set({
                items: rows.map(fromServer),
                _hydrated: true,
                _authSnapshot: true,
            });
        } catch {
            /* keep the optimistic post-merge state */
        }
    },
}));