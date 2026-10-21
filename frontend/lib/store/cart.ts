// lib/store/cart.ts
import { create } from 'zustand';

export type CartItem = {
    id: string;
    variantId: string;
    productId: string;
    name: string;
    brand?: string;
    image: string;
    variantLabel?: string;
    unitPrice: number;
    compareAtPrice?: number;
    quantity: number;
    slug?: string;
    stockCount?: number;
    stock?: string;
};

export type CartItemInput = Omit<
    CartItem,
    'id' | 'quantity' | 'unitPrice' | 'compareAtPrice'
> & {
    unitPrice: number | string;
    compareAtPrice?: number | string | null;
};

type CartState = {
    items: CartItem[];
    isLoading: boolean;

    itemCount: () => number;
    subtotal: () => number;

    addItem: (item: CartItemInput, qty?: number) => Promise<void>;
    updateQty: (id: string, qty: number) => Promise<void>;
    removeItem: (id: string) => Promise<void>;
    clear: () => void;
    hydrate: (items: CartItem[]) => void;
};

function toNumber(value: number | string | null | undefined): number | undefined {
    if (value === null || value === undefined) return undefined;
    const n = typeof value === 'string' ? parseFloat(value) : value;
    return Number.isFinite(n) ? n : undefined;
}

export const useCart = create<CartState>((set, get) => ({
    items: [],
    isLoading: false,

    itemCount: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),

    subtotal: () =>
        get().items.reduce(
            (sum, item) => sum + item.unitPrice * item.quantity,
            0,
        ),

    addItem: async (input, qty = 1) => {
        const unitPrice = toNumber(input.unitPrice);
        if (unitPrice === undefined) {
            throw new Error('Invalid unit price.');
        }

        const compareAtPrice = toNumber(input.compareAtPrice);

        set((state) => {
            const existing = state.items.find(
                (i) => i.variantId === input.variantId,
            );

            if (existing) {
                return {
                    items: state.items.map((i) =>
                        i.variantId === input.variantId
                            ? { ...i, quantity: i.quantity + qty }
                            : i,
                    ),
                };
            }

            const newItem: CartItem = {
                id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                variantId: input.variantId,
                productId: input.productId,
                name: input.name,
                brand: input.brand,
                image: input.image,
                variantLabel: input.variantLabel,
                unitPrice,
                compareAtPrice,
                quantity: qty,
                slug: input.slug,
                stockCount: input.stockCount,
                stock: input.stock,
            };

            return { items: [...state.items, newItem] };
        });
    },

    updateQty: async (id, qty) => {
        if (qty < 1) {
            return get().removeItem(id);
        }

        set((state) => ({
            items: state.items.map((i) =>
                i.id === id ? { ...i, quantity: qty } : i,
            ),
        }));
    },

    removeItem: async (id) => {
        set((state) => ({
            items: state.items.filter((i) => i.id !== id),
        }));
    },

    clear: () => set({ items: [] }),

    hydrate: (items) => set({ items }),
}));