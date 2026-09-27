// lib/store/products.ts
import { create } from 'zustand';
import { products as staticProducts, type ProductFull } from '@/data/products';

// Re-export the type so components can import it from here
export type Product = ProductFull;

const STORAGE_KEY = 'admin:products:v1';

type ProductsState = {
    customProducts: ProductFull[];
    _hydrated: boolean;

    hydrate: () => void;
    addProduct: (product: Omit<ProductFull, 'id' | 'createdAt'>) => ProductFull;
    updateProduct: (id: string, patch: Partial<ProductFull>) => void;
    removeProduct: (id: string) => void;
    getAll: () => ProductFull[];
    getById: (id: string) => ProductFull | undefined;
};

const load = (): ProductFull[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as ProductFull[]) : [];
    } catch {
        return [];
    }
};

const save = (items: ProductFull[]) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
        /* ignore quota errors */
    }
};

const genId = () =>
    `prd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export const useProducts = create<ProductsState>((set, get) => ({
    customProducts: [],
    _hydrated: false,

    hydrate: () => {
        if (get()._hydrated) return;
        set({ customProducts: load(), _hydrated: true });
    },

    addProduct: (product) => {
        const full: ProductFull = {
            ...product,
            id: genId(),
            createdAt: new Date().toISOString(),
        };
        const next = [full, ...get().customProducts];
        save(next);
        set({ customProducts: next });
        return full;
    },

    updateProduct: (id, patch) => {
        const next = get().customProducts.map((p) =>
            p.id === id ? { ...p, ...patch } : p
        );
        save(next);
        set({ customProducts: next });
    },

    removeProduct: (id) => {
        const next = get().customProducts.filter((p) => p.id !== id);
        save(next);
        set({ customProducts: next });
    },

    /**
     * Merged view: custom (admin-added) products first, then the static catalogue.
     * If a custom product reuses a static ID, the custom version wins and the
     * static one is skipped.
     */
    getAll: () => {
        const custom = get().customProducts;
        const customIds = new Set(custom.map((p) => p.id));
        const base = staticProducts.filter((p) => !customIds.has(p.id));
        return [...custom, ...base];
    },

    getById: (id) => get().getAll().find((p) => p.id === id),
}));