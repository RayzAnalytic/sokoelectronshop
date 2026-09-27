// lib/store/cart.ts
import { create } from 'zustand';

export type CartItem = {
    id: string;                    // unique line id (generated)
    variantId: string;             // SKU identifier
    productId: string;             // product identifier
    name: string;
    brand?: string;
    image: string;
    unitPrice: number;
    compareAtPrice?: number;
    quantity: number;
    slug: string;                  // URL slug for product link
    stockCount?: number;           // optional, for max-quantity checks
    stock?: string;                // optional, e.g. "In Stock" / "Low Stock"
};

type CartState = {
    items: CartItem[];
    isLoading: boolean;

    // computed getters
    itemCount: () => number;
    subtotal: () => number;

    // actions
    addItem: (item: Omit<CartItem, 'id' | 'quantity'>, qty?: number) => Promise<void>;
    updateQty: (id: string, qty: number) => Promise<void>;
    removeItem: (id: string) => Promise<void>;
    clear: () => void;
    hydrate: (items: CartItem[]) => void;
};

export const useCart = create<CartState>((set, get) => ({
    items: [],
    isLoading: false,

    itemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),

    subtotal: () =>
        get().items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),

    addItem: async (item, qty = 1) => {
        set({ isLoading: true });

        // Mock network delay — replace with real fetch when backend is ready
        await new Promise((resolve) => setTimeout(resolve, 200));

        set((state) => {
            const existing = state.items.find((i) => i.variantId === item.variantId);

            if (existing) {
                // Bump quantity on the existing line
                return {
                    items: state.items.map((i) =>
                        i.variantId === item.variantId
                            ? { ...i, quantity: i.quantity + qty }
                            : i
                    ),
                    isLoading: false,
                };
            }

            // New line
            return {
                items: [
                    ...state.items,
                    {
                        ...item,
                        id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                        quantity: qty,
                    },
                ],
                isLoading: false,
            };
        });
    },

    updateQty: async (id, qty) => {
        if (qty < 1) {
            return get().removeItem(id);
        }

        await new Promise((resolve) => setTimeout(resolve, 100));

        set((state) => ({
            items: state.items.map((i) => (i.id === id ? { ...i, quantity: qty } : i)),
        }));
    },

    removeItem: async (id) => {
        await new Promise((resolve) => setTimeout(resolve, 100));

        set((state) => ({
            items: state.items.filter((i) => i.id !== id),
        }));
    },

    clear: () => set({ items: [] }),

    hydrate: (items) => set({ items }),
}));