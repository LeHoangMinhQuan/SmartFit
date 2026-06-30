import { create } from "zustand";
import type { CartItem } from "../interfaces";

interface CartStore {
  items: CartItem[];
  // Replace entire cart (called after server merge/fetch)
  setItems: (items: CartItem[]) => void;
  // Guest add — server-sync happens separately on login
  addItem: (item: CartItem) => void;
  // Local quantity update (called after server PATCH succeeds)
  updateItem: (
    product_id: number,
    variant_id: number,
    quantity: number,
  ) => void;
  // Local remove (called after server DELETE succeeds)
  removeItem: (product_id: number, variant_id: number) => void;
  // Full wipe (called after server clearCart or logout)
  clearItems: () => void;
  // Derived helpers
  totalCount: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  setItems: (items) => set({ items }),

  addItem: (item) =>
    set((s) => {
      const exists = s.items.find(
        (i) =>
          i.product_id === item.product_id && i.variant_id === item.variant_id,
      );
      if (exists) {
        // Increment quantity in guest cart; server will reconcile on merge
        return {
          items: s.items.map((i) =>
            i.product_id === item.product_id && i.variant_id === item.variant_id
              ? { ...i, quantity: i.quantity + item.quantity }
              : i,
          ),
        };
      }
      return { items: [...s.items, item] };
    }),

  updateItem: (product_id, variant_id, quantity) =>
    set((s) => ({
      items: s.items.map((i) =>
        i.product_id === product_id && i.variant_id === variant_id
          ? { ...i, quantity }
          : i,
      ),
    })),

  removeItem: (product_id, variant_id) =>
    set((s) => ({
      items: s.items.filter(
        (i) => !(i.product_id === product_id && i.variant_id === variant_id),
      ),
    })),

  clearItems: () => set({ items: [] }),

  totalCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}));
